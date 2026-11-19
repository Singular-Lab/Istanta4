import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import { twMerge } from "@/utils/twMerge";
import dayjs from "dayjs";
import { useMemo } from "react";
import type { PeriodoInsegna, RiferimentoStoria } from "../../../lib/puntiVendita/storia";
import { useTinteCanali } from "./analisi";
import { periodoMesi, testoVolantini } from "./storia";

/** Un tratto troppo breve sparirebbe: almeno questa quota della barra. */
const LARGHEZZA_MINIMA = 2;

const chiaveCombinazione = (periodo: Pick<PeriodoInsegna, "canale" | "area">) => `${periodo.canale.id}|${periodo.area.id}`;

/** Le combinazioni di insegna e area dei periodi: la striscia serve solo se sono più di una. */
export const conCambioDiInsegna = (periodi: readonly PeriodoInsegna[] | undefined): boolean =>
  new Set((periodi ?? []).map(chiaveCombinazione)).size > 1;

/**
 * "Insegne nel tempo" (spec anagrafica-punti-vendita, "Insegne nel tempo nella scheda del punto
 * vendita"): sopra la Storia, solo se i volantini in cui compare il punto vendita sono di più
 * combinazioni di insegna e area. Una barra sugli anni con un tratto per periodo, nei colori delle
 * insegne delle altre pagine dei punti vendita; il tratto della combinazione attuale è pieno ed è
 * quello che la Storia analizza, gli altri sono tenui e fuori dall'analisi. Sotto, ogni periodo per
 * esteso. Non cambia niente della Storia.
 */
export function InsegneNelTempo({
  periodi,
  attuale,
}: {
  periodi: readonly PeriodoInsegna[];
  /** La combinazione di oggi del punto vendita, se c'è. */
  attuale: { canale: RiferimentoStoria | null; area: RiferimentoStoria | null };
}) {
  const canali = useMemo(() => {
    const unici = new Map(periodi.map(periodo => [periodo.canale.id, periodo.canale]));
    return [...unici.values()];
  }, [periodi]);
  const tinta = useTinteCanali(canali);
  if (!conCambioDiInsegna(periodi)) return null;

  const eAttuale = (periodo: PeriodoInsegna) => periodo.canale.id === attuale.canale?.id && periodo.area.id === attuale.area?.id;
  const inizio = dayjs(periodi[0].dal);
  const fine = dayjs(periodi.reduce((ultima, periodo) => (periodo.al > ultima ? periodo.al : ultima), periodi[0].al));
  const giorni = Math.max(1, fine.diff(inizio, "day") + 1);
  const quota = (data: string) => (dayjs(data).diff(inizio, "day") / giorni) * 100;
  // Gli anni che cominciano dentro la barra, per l'asse
  const anni: number[] = [];
  for (let anno = inizio.year() + 1; anno <= fine.year(); anno++) anni.push(anno);
  const nomeAttuale = [attuale.canale?.nome, attuale.area?.nome].filter(Boolean).join(" · ");

  return (
    <Sezione
      compatta
      titolo="Insegne nel tempo"
      descrizione={
        nomeAttuale
          ? `Nei volantini ha cambiato insegna. La Storia qui sotto analizza solo ${nomeAttuale}.`
          : "Nei volantini ha cambiato insegna."
      }
    >
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400" role="img" aria-label={`Insegne nel tempo: ${periodi.map(p => `${p.canale.nome} · ${p.area.nome} ${periodoMesi(p.dal, p.al)}`).join("; ")}`}>
        {periodi.map(periodo => {
          const sinistra = quota(periodo.dal);
          const larghezza = Math.max(LARGHEZZA_MINIMA, quota(periodo.al) - sinistra + 100 / giorni);
          return (
            <span
              key={`${chiaveCombinazione(periodo)}-${periodo.dal}`}
              data-attuale={eAttuale(periodo) || undefined}
              className={twMerge("absolute inset-y-0 rounded-full", !eAttuale(periodo) && "opacity-35")}
              style={{ left: `${Math.min(sinistra, 100 - LARGHEZZA_MINIMA)}%`, width: `${larghezza}%`, backgroundColor: tinta(periodo.canale.id).colore ?? "#94a3b8" }}
            />
          );
        })}
      </div>
      <div aria-hidden="true" className="relative mt-1 h-4 text-2xs tabular-nums text-slate-500">
        <span className="absolute left-0">{inizio.year()}</span>
        {anni.map(anno => {
          const posizione = quota(`${anno}-01-01`);
          // Vicino ai bordi l'etichetta si sovrapporrebbe al primo anno
          return posizione > 6 && posizione < 94 ? (
            <span key={anno} className="absolute -translate-x-1/2" style={{ left: `${posizione}%` }}>
              {anno}
            </span>
          ) : null;
        })}
      </div>
      <ol aria-label="Insegne nel tempo" className="mt-3 flex flex-col gap-2">
        {periodi.map(periodo => (
          <li key={`${chiaveCombinazione(periodo)}-${periodo.dal}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span
              aria-hidden="true"
              className={twMerge("h-2.5 w-2.5 flex-none rounded-full", !eAttuale(periodo) && "opacity-35")}
              style={{ backgroundColor: tinta(periodo.canale.id).colore ?? "#94a3b8" }}
            />
            <span className="font-medium text-slate-800 dark:text-slate-100">
              {periodo.canale.nome} · {periodo.area.nome}
            </span>
            <span className="text-xs tabular-nums text-slate-500">
              {periodoMesi(periodo.dal, periodo.al)} · {testoVolantini(periodo.volantini)}
            </span>
            {eAttuale(periodo) ? (
              <StatusBadge tono="info" etichetta="Analizzata qui sotto" />
            ) : (
              <span className="text-xs text-slate-500">non compresa nell'analisi</span>
            )}
          </li>
        ))}
      </ol>
    </Sezione>
  );
}
