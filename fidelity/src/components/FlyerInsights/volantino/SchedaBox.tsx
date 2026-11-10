import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { useState, type ReactNode } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { ETICHETTA_MECCANICA } from "../../../../lib/puntiVendita/analisi";
import { marcaFormato, testoReparto } from "./box";

/** Una riga dell'elenco dei dati: etichetta tenue, valore in evidenza. */
function Dato({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-slate-500 dark:text-slate-400">{etichetta}</dt>
      <dd className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-100">{children}</dd>
    </>
  );
}

/** Le foto del prodotto: quelle che non si caricano spariscono, senza icone rotte. */
function Foto({ foto, nome }: { foto: readonly string[]; nome: string }) {
  const [rotte, setRotte] = useState<ReadonlySet<string>>(new Set());
  const visibili = foto.filter(url => !rotte.has(url)).slice(0, 4);
  if (visibili.length === 0) return null;
  const [prima, ...altre] = visibili;
  const rotta = (url: string) => setRotte(attuali => new Set(attuali).add(url));
  return (
    <div className="flex gap-2">
      <img
        src={prima}
        alt={`Foto di ${nome}`}
        loading="lazy"
        onError={() => rotta(prima)}
        className="h-36 w-36 flex-none rounded-control border border-slate-200 bg-white object-contain dark:border-darkmode-400"
      />
      {altre.length > 0 && (
        <div className="flex flex-col gap-2">
          {altre.map(url => (
            <img
              key={url}
              src={url}
              alt=""
              loading="lazy"
              onError={() => rotta(url)}
              className="h-10 w-10 rounded-control border border-slate-200 bg-white object-contain dark:border-darkmode-400"
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Prezzo in offerta grande, barrato, sconto, prezzo al kg e punti come stampati. */
function Prezzi({ box }: { box: BoxInsight }) {
  if (box.prezzo === null && box.barrato === null && !box.punti) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Prezzo non stampato nel box.</p>;
  }
  return (
    <div aria-label="Prezzi" className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 tabular-nums">
      {box.prezzo !== null && <span className="text-3xl font-bold leading-none text-slate-800 dark:text-slate-100">{formatEuro(box.prezzo)}</span>}
      {box.barrato !== null && (
        <span className="text-base text-slate-500">
          <span className="sr-only">invece di </span>
          <s>{formatEuro(box.barrato)}</s>
        </span>
      )}
      {box.sconto !== null && (
        <Badge variant="info" size="sm">
          −{formatPercentuale(Math.round(box.sconto))}
        </Badge>
      )}
      {box.sottocosto && (
        <Badge variant="warning" size="sm">
          Sottocosto
        </Badge>
      )}
      {box.prezzoAlKg && <span className="basis-full text-xs text-slate-500">{box.prezzoAlKg}</span>}
      {box.punti && <span className="basis-full text-xs text-slate-500">Punti: {box.punti}</span>}
    </div>
  );
}

const ORIGINE: Readonly<Record<NonNullable<BoxInsight["origine"]>, string>> = {
  listino: "Dal listino",
  fuori_listino: "Fuori listino",
};

export interface SchedaBoxProps {
  box: BoxInsight;
  totalePagine: number;
  /** Apre il viaggio del prodotto pilota nei volantini della GDO. */
  onViaggio: () => void;
}

/**
 * La scheda di un box del volantino: il prodotto pilota (foto, prezzi, meccanica, reparto, linea del
 * distributore) e dove sta nel volantino (pagina, spazio), con il pulsante del viaggio del prodotto.
 */
export function SchedaBox({ box, totalePagine, onViaggio }: SchedaBoxProps) {
  const sottotitolo = marcaFormato(box);
  const reparto = testoReparto(box.reparto);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start gap-4">
        <Foto foto={box.foto} nome={box.nome} />
        <div className="min-w-0 flex-1">
          {sottotitolo && <p className="text-sm text-slate-600 dark:text-slate-300">{sottotitolo}</p>}
          {box.origine && (
            <p className="mt-1">
              <Badge variant="secondary" size="sm">
                {ORIGINE[box.origine]}
              </Badge>
            </p>
          )}
          <div className="mt-3">
            <Prezzi box={box} />
          </div>
        </div>
      </div>

      <dl aria-label="Dati del box" className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm tabular-nums">
        <Dato etichetta="Meccanica">{box.meccanica ? ETICHETTA_MECCANICA[box.meccanica] : VALORE_ASSENTE}</Dato>
        {box.meccanicaOriginale && <Dato etichetta="Meccanica nella fonte">{box.meccanicaOriginale}</Dato>}
        <Dato etichetta="Reparto">{reparto ?? VALORE_ASSENTE}</Dato>
        {/* La linea del distributore c'è solo se il cliente dichiara linee e il prodotto ne fa parte */}
        {box.linea && <Dato etichetta="Linea">{box.linea.nome || box.linea.sigla}</Dato>}
        <Dato etichetta="Pagina">{box.pagina !== null ? `${formatNumero(box.pagina)} di ${formatNumero(totalePagine)}` : VALORE_ASSENTE}</Dato>
        <Dato etichetta="Spazio">{box.geometria ? `${formatPercentuale(box.spazio)} della pagina` : VALORE_ASSENTE}</Dato>
        <Dato etichetta="Prodotti nel box">{formatNumero(box.prodotti)}</Dato>
        {box.codiceBox && <Dato etichetta="Codice box">{box.codiceBox}</Dato>}
      </dl>

      <div className="flex flex-col gap-2 border-t border-dashed border-slate-200 pt-4 dark:border-darkmode-400">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Dove compare il prodotto nei volantini della stessa GDO, con il prezzo di ogni edizione.
        </p>
        <div>
          <Button type="button" variant="primary" size="sm" onClick={onViaggio} disabled={!box.chiave}>
            <Lucide icon="Route" aria-hidden="true" className="mr-1.5 h-4 w-4" />
            Viaggio del prodotto
          </Button>
        </div>
      </div>
    </div>
  );
}

export default SchedaBox;
