import { SegnoLegenda } from "@/components/Grafici";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import Segmenti from "@/components/Base/Segmenti";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useMemo, useState } from "react";
import type { BoxInsight } from "../../../../lib/insightVolantino/tipi";
import { perSpazio, ripartizionePagina, sintesiPagina } from "./analisiPagina";
import { descrizioneBox, marcaFormato } from "./box";
import type { GruppoBox } from "./colori";
import { riquadroBox, testoApertura } from "./geometria";

export interface AnalisiPaginaProps {
  /** Le pagine aperte: una, o due affiancate. */
  pagine: readonly number[];
  totale: number;
  /** I box delle pagine aperte. */
  box: readonly BoxInsight[];
  /** Il gruppo di un box secondo "Colora per": dà la ripartizione e il colore di ogni riga. */
  gruppo: (box: BoxInsight) => GruppoBox;
  /** "Reparto", "Meccanica" o "Sconto". */
  titoloRipartizione: string;
  selezionato: string | null;
  /** I box trovati dalla ricerca, segnati nell'elenco; null: nessuna ricerca. */
  trovati: ReadonlySet<string> | null;
  /** Il box su cui si passa nell'elenco, da evidenziare sulla pagina; null quando si esce. */
  onRilievo: (id: string | null) => void;
  onApri: (box: BoxInsight) => void;
}

/** Percentuale intera, come le altre quote degli insight: "24%". */
const percento = (valore: number | null): string => (valore === null ? VALORE_ASSENTE : formatPercentuale(Math.round(valore)));

function Numero({ etichetta, valore, titolo }: { etichetta: string; valore: string; titolo?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" title={titolo}>
      <dt className="truncate text-3xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{etichetta}</dt>
      <dd className="text-base font-semibold tabular-nums text-slate-800 dark:text-slate-100">{valore}</dd>
    </div>
  );
}

/** "Insieme" analizza le pagine aperte insieme; un numero, quella pagina sola. */
type Ambito = "insieme" | number;

/**
 * L'analisi delle pagine aperte nel lettore: i numeri delle pagine, la ripartizione dei box e del
 * loro spazio secondo "Colora per" e l'elenco dei box dal più grande. Con due pagine aperte si
 * analizzano insieme o una alla volta. Passando su un box dell'elenco il suo riquadro si evidenzia
 * sulla pagina; scegliendolo si apre la sua scheda.
 */
export function AnalisiPagina(props: AnalisiPaginaProps) {
  // Girando pagina si riparte dalle pagine insieme
  return <Analisi key={props.pagine.join("-")} {...props} />;
}

function Analisi({ pagine, totale, box: tuttiIBox, gruppo, titoloRipartizione, selezionato, trovati, onRilievo, onApri }: AnalisiPaginaProps) {
  const [ambito, setAmbito] = useState<Ambito>("insieme");
  const analizzate = ambito === "insieme" ? pagine : [ambito];
  const piuPagine = analizzate.length > 1;
  const box = useMemo(
    () => (ambito === "insieme" ? tuttiIBox : tuttiIBox.filter(voce => voce.pagina === ambito)),
    [ambito, tuttiIBox]
  );
  const sintesi = useMemo(() => sintesiPagina(box, analizzate.length), [box, analizzate.length]);
  const gruppi = useMemo(() => ripartizionePagina(box, gruppo, analizzate.length), [box, gruppo, analizzate.length]);
  const elenco = useMemo(() => perSpazio(box), [box]);
  // La barra è la superficie delle pagine: ogni gruppo vi occupa la sua quota, il resto è spazio libero
  const scala = Math.max(100, gruppi.reduce((somma, voce) => somma + voce.spazio, 0));
  const opzioni = [
    { valore: "insieme" as Ambito, etichetta: "Insieme" },
    ...pagine.map(numero => ({ valore: numero as Ambito, etichetta: `Pag. ${formatNumero(numero)}` })),
  ];

  return (
    <aside
      aria-label="Analisi della pagina"
      data-testid="analisi-pagina"
      className="flex flex-col gap-4 rounded-control border border-slate-200 bg-white p-4 dark:border-darkmode-400 dark:bg-darkmode-700"
    >
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{testoApertura(analizzate)}</h4>
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">di {formatNumero(totale)}</span>
        </div>
        {pagine.length > 1 && <Segmenti<Ambito> etichetta="Pagine da analizzare" opzioni={opzioni} valore={ambito} onChange={setAmbito} />}
      </header>

      {box.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{piuPagine ? "Nessun box in queste pagine." : "Nessun box in questa pagina."}</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-x-3 gap-y-3">
            <Numero etichetta="Box" valore={formatNumero(sintesi.box)} />
            <Numero etichetta="Spazio" valore={percento(sintesi.spazio)} titolo={piuPagine ? "Spazio delle pagine occupato dai box" : "Spazio della pagina occupato dai box"} />
            <Numero etichetta="Sconto medio" valore={percento(sintesi.scontoMedio)} />
            <Numero etichetta="Fidelity" valore={formatNumero(sintesi.fidelity)} titolo="Box con meccanica Prezzo Fidelity" />
            <Numero etichetta="Sottocosto" valore={formatNumero(sintesi.sottocosto)} />
          </dl>

          <section aria-label={`Per ${titoloRipartizione.toLocaleLowerCase("it")}`} className="flex flex-col gap-2">
            <h5 className="text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Per {titoloRipartizione.toLocaleLowerCase("it")}
            </h5>
            <svg viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true" className="block h-2 w-full overflow-hidden rounded-full">
              <rect width="100" height="4" className="fill-slate-100 dark:fill-darkmode-500" />
              {gruppi.map((voce, posto) => {
                const inizio = gruppi.slice(0, posto).reduce((somma, prima) => somma + prima.spazio, 0);
                return (
                  <rect
                    key={voce.id}
                    x={(inizio / scala) * 100}
                    width={(voce.spazio / scala) * 100}
                    height="4"
                    fill={voce.tinta.colore}
                    className={voce.tinta.classe}
                  />
                );
              })}
            </svg>
            <ul className="flex flex-col gap-1">
              {gruppi.map(voce => (
                <li key={voce.id} data-testid={`gruppo-${voce.id}`} className="flex items-center gap-2 text-xs">
                  <SegnoLegenda forma="quadrato" tinta={voce.tinta} />
                  <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200" title={voce.etichetta}>
                    {voce.etichetta}
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">{voce.box === 1 ? "1 box" : `${formatNumero(voce.box)} box`}</span>
                  <span className="w-10 text-right font-semibold tabular-nums text-slate-700 dark:text-slate-200">{percento(voce.spazio)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label={piuPagine ? "Box delle pagine" : "Box della pagina"} className="flex flex-col gap-2">
            <h5 className="text-3xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {piuPagine ? "Box delle pagine, dal più grande" : "Box della pagina, dal più grande"}
            </h5>
            <ul className="-mx-2 flex flex-col">
              {elenco.map(voce => {
                const scelto = voce.id === selezionato;
                const trovato = trovati?.has(voce.id) ?? false;
                const senzaPosizione = !riquadroBox(voce.geometria);
                const dettagli = [piuPagine && voce.pagina !== null ? `pag. ${formatNumero(voce.pagina)}` : null, marcaFormato(voce)].filter(Boolean).join(" · ");
                return (
                  <li key={voce.id}>
                    <button
                      type="button"
                      data-testid={`riga-box-${voce.id}`}
                      data-trovato={trovato ? "" : undefined}
                      aria-label={`${descrizioneBox(voce)}, spazio ${percento(voce.spazio)}`}
                      aria-current={scelto ? "true" : undefined}
                      onMouseEnter={() => onRilievo(voce.id)}
                      onMouseLeave={() => onRilievo(null)}
                      onFocus={() => onRilievo(voce.id)}
                      onBlur={() => onRilievo(null)}
                      onClick={() => onApri(voce)}
                      className={twMerge(
                        "flex w-full items-start gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:hover:bg-darkmode-600",
                        trovato && "bg-primary/5 dark:bg-indigo-300/10",
                        scelto && "bg-primary/10 ring-1 ring-primary/40 dark:bg-indigo-300/15"
                      )}
                    >
                      <span className="pt-0.5">
                        <SegnoLegenda forma="quadrato" tinta={gruppo(voce).tinta} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">{voce.nome || "Box senza nome"}</span>
                        {(dettagli || senzaPosizione) && (
                          <span className="truncate text-3xs text-slate-500 dark:text-slate-400">
                            {[dettagli, senzaPosizione ? "senza posizione" : null].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="flex flex-none flex-col items-end text-3xs tabular-nums text-slate-500 dark:text-slate-400">
                        {/* Un prezzo non stampato non si segna: resterebbe una colonna di "N/D" */}
                        {voce.prezzo !== null && <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{formatEuro(voce.prezzo)}</span>}
                        <span>
                          {voce.sconto !== null ? `−${percento(voce.sconto)} · ` : ""}
                          {percento(voce.spazio)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </aside>
  );
}

export default AnalisiPagina;
