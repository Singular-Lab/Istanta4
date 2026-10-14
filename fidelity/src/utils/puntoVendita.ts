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
