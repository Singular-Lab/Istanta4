import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { useEffect, useState, type ReactNode } from "react";
import type { BoxInsight, ProdottoInsight } from "../../../../lib/insightVolantino/tipi";
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

/** Un EAN con il comando per copiarlo, dove il browser lo permette. */
function Ean({ codice }: { codice: string }) {
  const [copiato, setCopiato] = useState(false);
  useEffect(() => {
    if (!copiato) return;
    const attesa = setTimeout(() => setCopiato(false), 1500);
    return () => clearTimeout(attesa);
  }, [copiato]);
  const appunti = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  const copia = () => {
    appunti?.writeText(codice).then(
      () => setCopiato(true),
      () => setCopiato(false)
    );
  };
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {codice}
      {appunti && (
        <button
          type="button"
          aria-label={copiato ? `EAN ${codice} copiato` : `Copia l'EAN ${codice}`}
          title={copiato ? "Copiato" : "Copia"}
          onClick={copia}
          className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-darkmode-600 dark:hover:text-slate-200"
        >
          <Lucide icon={copiato ? "Check" : "Copy"} aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}

/** I dati di un prodotto che la fonte fornisce: solo quelli presenti, niente righe vuote. */
function DatiProdotto({ prodotto }: { prodotto: ProdottoInsight }) {
  const voci: Array<[string, ReactNode]> = [];
  if (prodotto.codice) voci.push(["Codice", <span className="font-mono text-xs">{prodotto.codice}</span>]);
  // Il key delle voci è l'etichetta: ognuna compare una volta sola
  if (prodotto.ean.length > 0) {
    voci.push([
      "EAN",
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {prodotto.ean.map(codice => (
          <Ean key={codice} codice={codice} />
        ))}
      </span>,
    ]);
  }
  if (prodotto.settore) voci.push(["Settore", prodotto.settore]);
  if (prodotto.segmento) voci.push(["Segmento", prodotto.segmento]);
  if (prodotto.tema) voci.push(["Tema", prodotto.tema]);
  if (prodotto.ruolo) voci.push(["Ruolo", prodotto.ruolo]);
  if (prodotto.prezzo !== null) voci.push(["Prezzo", formatEuro(prodotto.prezzo)]);
  const sottotitolo = [prodotto.marca, prodotto.formato, prodotto.gusto].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col gap-2 rounded-control border border-slate-200 p-3 dark:border-darkmode-400">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">{prodotto.nome}</p>
        {sottotitolo && <p className="text-xs text-slate-500 dark:text-slate-400">{sottotitolo}</p>}
      </div>
      {voci.length > 0 ? (
        <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm tabular-nums">
          {voci.map(([etichetta, valore]) => (
            <Dato key={etichetta} etichetta={etichetta}>
              {valore}
            </Dato>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">La fonte non fornisce codice, EAN né altri dati del prodotto.</p>
      )}
    </li>
  );
}

/** I prodotti del box, pilota per primo, con i loro codici e i dati anagrafici. */
function ProdottiDelBox({ prodotti }: { prodotti: readonly ProdottoInsight[] }) {
  if (prodotti.length === 0) return null;
  return (
    <section aria-label="Prodotti del box" className="flex flex-col gap-2">
      <h3 className="text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {prodotti.length === 1 ? "Il prodotto" : `I ${formatNumero(prodotti.length)} prodotti del box`}
      </h3>
      <ul className="flex flex-col gap-2">
        {prodotti.map(prodotto => (
          <DatiProdotto key={prodotto.chiave} prodotto={prodotto} />
        ))}
      </ul>
    </section>
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
 * distributore), dove sta nel volantino (pagina, spazio), i prodotti del box con codice, EAN e dati
 * anagrafici, e il pulsante del viaggio del prodotto.
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

      {box.dettaglioProdotti && <ProdottiDelBox prodotti={box.dettaglioProdotti} />}

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
