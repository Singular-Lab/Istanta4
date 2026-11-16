import type { PuntoVenditaResponseDTO } from "../../server/core/dto";

/** I codici del sistema della GDO (es. id ANACAN) conservati nei meta, con un'etichetta leggibile. */
export const codiciGdo = (meta?: Record<string, unknown>) =>
  Object.entries(meta ?? {})
    .filter(([, valore]) => valore !== null && valore !== undefined && String(valore).trim() !== "")
    .map(([campo, valore]) => ({ etichetta: campo.replace(/_/g, " ").toUpperCase(), valore: String(valore) }));

/** "Via Roma 1 - 55100 Lucca (LU)": il DTO in indirizzo_completo ha solo la via. */
export const indirizzoCompleto = (pv: Pick<PuntoVenditaResponseDTO, "indirizzo" | "cap" | "citta" | "provincia">) => {
  const localita = [pv.cap, pv.citta, pv.provincia && `(${pv.provincia})`].filter(Boolean).join(" ");
  return [pv.indirizzo, localita].filter(Boolean).join(" - ");
};

/** "Conad City · Toscana", o la sigla quando la combinazione non ha nomi. */
export const canaleArea = (pv: Pick<PuntoVenditaResponseDTO, "nome_canale" | "nome_area" | "sigla_combinazione">) =>
  [pv.nome_canale, pv.nome_area].filter(Boolean).join(" · ") || pv.sigla_combinazione || "-";

const normalizza = (valore: unknown) =>
  String(valore ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type PuntoVenditaFiltrabile = Pick<PuntoVenditaResponseDTO, "nome" | "citta" | "indirizzo" | "cap" | "meta" | "id_canale" | "id_area">;

/** Un codice confrontato per intero: senza maiuscole, accenti e zeri iniziali ("004512" = "4512"). */
const normalizzaCodice = (valore: unknown) => normalizza(String(valore ?? "").trim()).replace(/^0+(?=.)/, "");

/** I valori di un campo dei meta: uno solo, o ciascuno quando il campo ne ha più (es. id ANACAN alternativi). */
const valoriDelCampo = (meta: Record<string, unknown> | undefined, campo: string): unknown[] => {
  const valore = meta?.[campo];
  if (valore === null || valore === undefined) return [];
  return Array.isArray(valore) ? valore : [valore];
};

/**
 * Ricerca per nome, citta, indirizzo, CAP e codici GDO (senza maiuscole ne accenti, anche per una
 * parte del testo) e filtri per canale e area. Con `campo` (un campo dei meta, es. "id_anacan") la
 * ricerca guarda solo quel codice e lo vuole uguale, senza contare gli zeri iniziali.
 */
export const filtraPuntiVendita = <T extends PuntoVenditaFiltrabile>(
  puntiVendita: T[],
  { testo = "", campo, idCanale, idArea }: { testo?: string; campo?: string; idCanale?: string; idArea?: string },
) => {
  const cercato = normalizza(testo.trim());
  const codiceCercato = normalizzaCodice(testo);
  const trovato = (pv: T) =>
    campo
      ? valoriDelCampo(pv.meta, campo).some(v => normalizzaCodice(v) === codiceCercato)
      : [pv.nome, pv.citta, pv.indirizzo, pv.cap, ...codiciGdo(pv.meta).map(c => c.valore)].some(v => normalizza(v).includes(cercato));
  return puntiVendita.filter(pv =>
    (!idCanale || pv.id_canale === idCanale) &&
    (!idArea || pv.id_area === idArea) &&
    (!cercato || trovato(pv)));
};

/** Quanti punti vendita per canale o per area, in ordine di nome. */
export const contaPer = (
  puntiVendita: Pick<PuntoVenditaResponseDTO, "id_canale" | "id_area" | "nome_canale" | "nome_area">[],
  dimensione: "canale" | "area",
) => {
  const conteggi = new Map<string, { id: string; nome: string; totale: number }>();
  for (const pv of puntiVendita) {
    const id = dimensione === "canale" ? pv.id_canale : pv.id_area;
    if (!id) continue;
    const voce = conteggi.get(id) ?? { id, nome: (dimensione === "canale" ? pv.nome_canale : pv.nome_area) ?? id, totale: 0 };
    voce.totale++;
    conteggi.set(id, voce);
  }
  return [...conteggi.values()].sort((a, b) => a.nome.localeCompare(b.nome));
};

/**
 * Valori del form di modifica di un PV. I campi facoltativi che il DB ha a null diventano
 * stringhe vuote: lo schema yup (string, non nullable) altrimenti blocca il salvataggio
 * con "regione cannot be null".
 */
export const valoriFormPuntoVendita = (pv: PuntoVenditaResponseDTO) => ({
  nome: pv.nome ?? "",
  citta: pv.citta ?? "",
  indirizzo: pv.indirizzo ?? "",
  cap: pv.cap ?? "",
  canaleArea: pv.id_combinazione_canale_area ?? "",
  // Il DTO porta le coordinate in coordinate, a 0,0 quando mancano
  lat: pv.has_coordinate ? pv.coordinate?.lat : undefined,
  lon: pv.has_coordinate ? pv.coordinate?.lon : undefined,
  provincia: pv.provincia ?? "",
  regione: pv.regione ?? "",
  telefono: pv.telefono ?? "",
  ragioneSociale: pv.ragionesociale ?? "",
});
