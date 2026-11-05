import type { TonoStato } from "@/constants/stati";
import { STATO_LAVORAZIONE_KIT_RUNTIME } from "../../../lib/enums";
import { STATI_KIT_MATERIALI, type Riferimento, type StatoKitMateriali } from "../../../lib/materiali/tipi";
import type { KitAvanzamento, PromoAvanzamento, TipoKitAvanzamento } from "../../../lib/produzione/avanzamento";

/** Logica della pagina Avanzamento produzione, senza React: filtri, conteggi e testi della scadenza. */

export type FiltroTipo = "tutti" | TipoKitAvanzamento;

export interface FiltriAvanzamento {
  tipo: FiltroTipo;
  /** Chiave dell'area (id, o nome se l'id manca); vuota per tutte. */
  area: string;
  canale: string;
}

export const FILTRI_VUOTI: FiltriAvanzamento = { tipo: "tutti", area: "", canale: "" };

/** Le promo entro questi giorni dalla scadenza della lavorazione sono "in scadenza", come nello stato della promo. */
export const GIORNI_IN_SCADENZA = 7;

export const chiaveRiferimento = (riferimento: Riferimento): string => riferimento.id || riferimento.nome;

export const filtriAttivi = (filtri: FiltriAvanzamento): boolean =>
  filtri.tipo !== "tutti" || filtri.area !== "" || filtri.canale !== "";

export const kitVisibili = (promo: PromoAvanzamento, filtri: FiltriAvanzamento): KitAvanzamento[] =>
  promo.kit.filter(
    (kit) =>
      (filtri.tipo === "tutti" || kit.tipo === filtri.tipo) &&
      (!filtri.area || chiaveRiferimento(kit.area) === filtri.area) &&
      (!filtri.canale || chiaveRiferimento(kit.canale) === filtri.canale)
  );

/** Con un filtro su tipo, area o canale restano solo le promo che hanno kit corrispondenti. */
export const promoVisibili = (promozioni: PromoAvanzamento[], filtri: FiltriAvanzamento): PromoAvanzamento[] =>
  filtriAttivi(filtri) ? promozioni.filter((promo) => kitVisibili(promo, filtri).length > 0) : promozioni;

export const contaPerStato = (kit: KitAvanzamento[]): Record<StatoKitMateriali, number> => {
  const conteggi = Object.fromEntries(STATI_KIT_MATERIALI.map((stato) => [stato, 0])) as Record<StatoKitMateriali, number>;
  for (const voce of kit) conteggi[voce.stato] = (conteggi[voce.stato] ?? 0) + 1;
  return conteggi;
};

const inRitardo = (promo: PromoAvanzamento) => promo.giorniAllaScadenza !== null && promo.giorniAllaScadenza < 0;
const inScadenza = (promo: PromoAvanzamento) =>
  promo.giorniAllaScadenza !== null && promo.giorniAllaScadenza >= 0 && promo.giorniAllaScadenza <= GIORNI_IN_SCADENZA;

export type IdElemento = "errori" | "revisione" | "ritardo" | "scadenza" | "nonAvviati";

export interface ElementoDaGuardare {
  id: IdElemento;
  etichetta: string;
  descrizione: string;
  tono: TonoStato;
  /** Quanti ce ne sono nelle promo visibili (kit o promo, secondo l'elemento). */
  conta: (promozioni: PromoAvanzamento[], filtri: FiltriAvanzamento) => number;
  /** La promo ne fa parte: scegliendo l'elemento restano solo queste. */
  riguarda: (promo: PromoAvanzamento, filtri: FiltriAvanzamento) => boolean;
}

const elementoDiKit = (
  id: IdElemento,
  stato: StatoKitMateriali,
  testi: Pick<ElementoDaGuardare, "etichetta" | "descrizione" | "tono">
): ElementoDaGuardare => {
  const nellaPromo = (promo: PromoAvanzamento, filtri: FiltriAvanzamento) =>
    kitVisibili(promo, filtri).filter((kit) => kit.stato === stato).length;
  return {
    id,
    ...testi,
    conta: (promozioni, filtri) => promozioni.reduce((totale, promo) => totale + nellaPromo(promo, filtri), 0),
    riguarda: (promo, filtri) => nellaPromo(promo, filtri) > 0,
  };
};

const elementoDiPromo = (
  id: IdElemento,
  condizione: (promo: PromoAvanzamento) => boolean,
  testi: Pick<ElementoDaGuardare, "etichetta" | "descrizione" | "tono">
): ElementoDaGuardare => ({
  id,
  ...testi,
  conta: (promozioni) => promozioni.filter(condizione).length,
  riguarda: (promo) => condizione(promo),
});

/** In testa alla pagina, nell'ordine in cui chiedono di intervenire. */
export const ELEMENTI_DA_GUARDARE: readonly ElementoDaGuardare[] = [
  elementoDiKit("errori", STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI, {
    etichetta: "Kit con errori",
    descrizione: "File rifiutati da correggere",
    tono: "warning",
  }),
  elementoDiKit("revisione", STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE, {
    etichetta: "Kit in revisione",
    descrizione: "Da accettare o rifiutare",
    tono: "brand",
  }),
  elementoDiPromo("ritardo", inRitardo, {
    etichetta: "Promo in ritardo",
    descrizione: "Scadenza della lavorazione passata",
    tono: "danger",
  }),
  elementoDiPromo("scadenza", inScadenza, {
    etichetta: `Scadono entro ${GIORNI_IN_SCADENZA} giorni`,
    descrizione: "Lavorazione da chiudere",
    tono: "warning",
  }),
  elementoDiKit("nonAvviati", "NON_AVVIATO", {
    etichetta: "Kit non avviati",
    descrizione: "Previsti ma non ancora avviati",
    tono: "neutral",
  }),
];

const plurale = (numero: number, singolare: string, plurale: string) => `${numero} ${numero === 1 ? singolare : plurale}`;

/** Testo e tono della scadenza della lavorazione, dai giorni che mancano (negativi se passata). */
export const descriviScadenza = (giorni: number | null): { testo: string; tono: TonoStato } => {
  if (giorni === null) return { testo: "Senza scadenza", tono: "neutral" };
  if (giorni < 0) return { testo: `In ritardo di ${plurale(-giorni, "giorno", "giorni")}`, tono: "danger" };
  if (giorni === 0) return { testo: "Scade oggi", tono: "warning" };
  if (giorni === 1) return { testo: "Scade domani", tono: "warning" };
  if (giorni <= GIORNI_IN_SCADENZA) return { testo: `Scade tra ${giorni} giorni`, tono: "warning" };
  return { testo: `Tra ${giorni} giorni`, tono: "neutral" };
};

/** Prima i kit che chiedono un intervento, i pubblicati in fondo; poi volantini prima dei POP e per titolo. */
const ORDINE_STATI: readonly StatoKitMateriali[] = [
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI,
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE,
  STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
  "NON_AVVIATO",
  STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO,
];

export const ordinaKit = (kit: KitAvanzamento[]): KitAvanzamento[] =>
  [...kit].sort(
    (a, b) =>
      ORDINE_STATI.indexOf(a.stato) - ORDINE_STATI.indexOf(b.stato) ||
      (a.tipo === b.tipo ? 0 : a.tipo === "VOL" ? -1 : 1) ||
      a.titolo.localeCompare(b.titolo, "it", { sensitivity: "base" })
  );

/** Aree e canali dei kit, ognuno una volta, per nome: le tendine dei filtri. */
export const opzioniFiltri = (promozioni: PromoAvanzamento[]): { aree: Riferimento[]; canali: Riferimento[] } => {
  const aree = new Map<string, Riferimento>();
  const canali = new Map<string, Riferimento>();
  for (const kit of promozioni.flatMap((promo) => promo.kit)) {
    if (chiaveRiferimento(kit.area)) aree.set(chiaveRiferimento(kit.area), kit.area);
    if (chiaveRiferimento(kit.canale)) canali.set(chiaveRiferimento(kit.canale), kit.canale);
  }
  const perNome = (a: Riferimento, b: Riferimento) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" });
  return { aree: [...aree.values()].sort(perNome), canali: [...canali.values()].sort(perNome) };
};
