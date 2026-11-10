import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import { twMerge } from "@/utils/twMerge";
import type { OpzioniDettaglioPromozioneVolantini } from "../../../lib/consultazione/tipi";
import { testoVolantini } from "../VolantiniKit/testi";
import { conValoreScelto } from "./analisi";

export interface FiltriPromozioneProps {
  opzioni: OpzioniDettaglioPromozioneVolantini;
  idCanale: string | undefined;
  idArea: string | undefined;
  onCambiaInsegna: (idCanale: string) => void;
  onCambiaArea: (idArea: string) => void;
  onAzzera: () => void;
  /** Volantini che corrispondono ai filtri, sul totale della promozione. */
  mostrati: number;
  totale: number;
  /** Arriva il dettaglio dei filtri nuovi: la barra lo dice, la pagina resta quella di prima. */
  inAttesa: boolean;
}

/**
 * La barra dei filtri del dettaglio: insegna e area, con quanti volantini si vedono. Resta in vista
 * scorrendo, sotto la barra in alto dell'app: tutto quello che segue conta solo i volantini filtrati.
 */
export function FiltriPromozione({
  opzioni,
  idCanale,
  idArea,
  onCambiaInsegna,
  onCambiaArea,
  onAzzera,
  mostrati,
  totale,
  inAttesa,
}: FiltriPromozioneProps) {
  const conFiltri = Boolean(idCanale || idArea);
  const insegne = conValoreScelto(opzioni.insegne, idCanale, "Insegna scelta");
  const aree = conValoreScelto(opzioni.aree, idArea, "Area scelta");

  return (
    <div
      role="search"
      aria-label="Filtri della promozione"
      className={twMerge(
        "sticky top-[5.25rem] z-20 rounded-card border border-slate-200 bg-white/95 px-4 py-3 shadow-card backdrop-blur",
        "dark:border-darkmode-400 dark:bg-darkmode-600/95"
      )}
    >
      <BarraFiltri
        variante="libera"
        destra={
          <>
            <p aria-live="polite" className="flex items-center gap-2 text-sm tabular-nums text-slate-500 dark:text-slate-400">
              {inAttesa && <Lucide icon="LoaderCircle" aria-hidden="true" className="h-3.5 w-3.5 motion-safe:animate-spin" />}
              {testoVolantini(mostrati, totale)}
            </p>
            {conFiltri && (
              <Button type="button" variant="outline-secondary" size="sm" onClick={onAzzera}>
                <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Azzera filtri
              </Button>
            )}
          </>
        }
      >
        <FormSelect
          formSelectSize="sm"
          aria-label="Insegna"
          className="sm:w-48"
          value={idCanale ?? ""}
          onChange={evento => onCambiaInsegna(evento.target.value)}
        >
          <option value="">Tutte le insegne</option>
          {insegne.map(insegna => (
            <option key={insegna.id} value={insegna.id}>
              {insegna.nome}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          formSelectSize="sm"
          aria-label="Area"
          className="sm:w-48"
          value={idArea ?? ""}
          onChange={evento => onCambiaArea(evento.target.value)}
        >
          <option value="">Tutte le aree</option>
          {aree.map(area => (
            <option key={area.id} value={area.id}>
              {area.nome}
            </option>
          ))}
        </FormSelect>
      </BarraFiltri>
    </div>
  );
}

export default FiltriPromozione;
