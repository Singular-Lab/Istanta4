import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { useState, type ReactNode } from "react";
import { formattaValore } from "../../../../lib/insightVolantino/calore";
import {
  SOGLIA_INDICE_SPAZIO,
  type PrevisioneBox,
  type PrevisioneVolantino,
  type RendimentoBox,
  type RendimentoVolantino,
} from "../../../../lib/insightVolantino/rendimento";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { ETICHETTA_MECCANICA } from "../../../../lib/puntiVendita/analisi";
import {
  ETICHETTE_AFFIDABILITA,
  ETICHETTE_TIPO_PREVISIONE,
  scartoPercentuale,
  testoCasi,
  testoPrevisto,
  testoScarto,
  VARIANTE_AFFIDABILITA,
} from "../analisi/affidabilita";
import { marcaFormato, testoReparto, testoVisibilita } from "./box";

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

/** Le vendite del box dal rendimento del volantino, con la misura principale del file. */
export interface VenditeScheda {
  box: RendimentoBox;
  misura: RendimentoVolantino["misura"];
}

/** La previsione del box, con tipo e unità della previsione del volantino. */
export interface PrevisioneScheda {
  box: PrevisioneBox;
  tipo: PrevisioneVolantino["tipo"];
  unita: PrevisioneVolantino["unita"];
}

export interface SchedaBoxProps {
  box: BoxInsight;
  totalePagine: number;
  /** Apre il viaggio del prodotto pilota nei volantini della GDO. */
  onViaggio: () => void;
  /** Vendite del box nel periodo della promo, se il cliente le ha importate. */
  vendite?: VenditeScheda | null;
  /** Previsione del box, se c'è. */
  previsione?: PrevisioneScheda | null;
  /** Valore del box nella misura della mappa di calore accesa. */
  misuraCalore?: { etichetta: string; testo: string } | null;
}

/** "1.234 pezzi · € 2.345,00", con il valore in euro solo se il file lo porta. */
const testoVendite = ({ box, misura }: VenditeScheda): string => {
  const pezzi = box.pezzi === 1 ? "1 pezzo" : `${formatNumero(box.pezzi)} pezzi`;
  return misura === "valore" && box.valore !== null ? `${formatEuro(box.valore)} · ${pezzi}` : pezzi;
};

/** "1,8: rende più dello spazio che occupa" secondo SOGLIA_INDICE_SPAZIO. */
const testoIndiceSpazio = (indice: number | null): string => {
  if (indice === null || !Number.isFinite(indice)) return VALORE_ASSENTE;
  const valore = formattaValore(indice, "indice");
  if (indice >= SOGLIA_INDICE_SPAZIO) return `${valore}: rende più dello spazio che occupa`;
  if (indice <= 1 / SOGLIA_INDICE_SPAZIO) return `${valore}: rende meno dello spazio che occupa`;
  return `${valore}: in linea con lo spazio`;
};

/** Vendite e previsione del box: compaiono solo se ci sono. */
function RendimentoScheda({ vendite, previsione }: { vendite: VenditeScheda | null; previsione: PrevisioneScheda | null }) {
  if (!vendite && !previsione) return null;
  const scarto = previsione ? scartoPercentuale(previsione.box.valore, previsione.box.reale) : null;
  return (
    <dl aria-label="Vendite e previsione" className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-dashed border-slate-200 pt-4 text-sm tabular-nums dark:border-darkmode-400">
      {vendite && (
        <>
          <Dato etichetta="Vendite nella promo">{testoVendite(vendite)}</Dato>
          <Dato etichetta="Quota delle vendite">{formatPercentuale(vendite.box.quota)}</Dato>
          <Dato etichetta="Quota dello spazio">{formatPercentuale(vendite.box.quotaSpazio)}</Dato>
          <Dato etichetta="Vendite per spazio">{testoIndiceSpazio(vendite.box.indiceSpazio)}</Dato>
          {vendite.box.prodottiSenzaVendite > 0 && (
            <Dato etichetta="Prodotti senza vendite">
              {formatNumero(vendite.box.prodottiSenzaVendite)} su {formatNumero(vendite.box.prodotti)}
            </Dato>
          )}
        </>
      )}
      {previsione && (
        <>
          <Dato etichetta="Previsione">
            {testoPrevisto(previsione.box.valore, previsione.unita)}
            {previsione.tipo === "teorica" && (
              <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">({ETICHETTE_TIPO_PREVISIONE.teorica.toLowerCase()})</span>
            )}
          </Dato>
          <Dato etichetta="Affidabilità">
            <span className="inline-flex flex-wrap items-center gap-2">
              <Badge variant={VARIANTE_AFFIDABILITA[previsione.box.affidabilita]} size="sm">
                {ETICHETTE_AFFIDABILITA[previsione.box.affidabilita]}
              </Badge>
              <span className="font-normal text-slate-500 dark:text-slate-400">{testoCasi(previsione.box.casiStorici)}</span>
            </span>
          </Dato>
          {previsione.box.reale !== null && (
            <>
              <Dato etichetta="Reale">{testoPrevisto(previsione.box.reale, previsione.unita)}</Dato>
              <Dato etichetta="Scarto dal previsto">{testoScarto(scarto)}</Dato>
            </>
          )}
        </>
      )}
    </dl>
  );
}

/**
 * La scheda di un box del volantino: il prodotto pilota (foto, prezzi, meccanica, reparto) e dove
 * sta nel volantino (pagina, spazio, visibilità stimata), le vendite e la previsione quando ci
 * sono, con il pulsante del viaggio del prodotto.
 */
export function SchedaBox({ box, totalePagine, onViaggio, vendite = null, previsione = null, misuraCalore = null }: SchedaBoxProps) {
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
        {misuraCalore && <Dato etichetta={`${misuraCalore.etichetta} (mappa di calore)`}>{misuraCalore.testo}</Dato>}
        <Dato etichetta="Meccanica">{box.meccanica ? ETICHETTA_MECCANICA[box.meccanica] : VALORE_ASSENTE}</Dato>
        {box.meccanicaOriginale && <Dato etichetta="Meccanica nella fonte">{box.meccanicaOriginale}</Dato>}
        <Dato etichetta="Reparto">{reparto ?? VALORE_ASSENTE}</Dato>
        <Dato etichetta="Pagina">{box.pagina !== null ? `${formatNumero(box.pagina)} di ${formatNumero(totalePagine)}` : VALORE_ASSENTE}</Dato>
        <Dato etichetta="Spazio">{box.geometria ? `${formatPercentuale(box.spazio)} della pagina` : VALORE_ASSENTE}</Dato>
        <Dato etichetta="Visibilità stimata">{testoVisibilita(box.visibilita)}</Dato>
        <Dato etichetta="Prodotti nel box">{formatNumero(box.prodotti)}</Dato>
        {box.codiceBox && <Dato etichetta="Codice box">{box.codiceBox}</Dato>}
      </dl>

      <RendimentoScheda vendite={vendite} previsione={previsione} />

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
