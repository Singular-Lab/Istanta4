import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import type { Tinta } from "@/components/Grafici";
import { ruoliDaIndirizzo, ruoliInIndirizzo, SceltaRuoli } from "@/components/SceltaRuoli";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { KitPromozioneConsultazione, ReferenzaPromozione, Riferimento } from "../../../lib/consultazione/tipi";
import { unitaPrezzo } from "../../../lib/insightVolantino/unita";
import { ETICHETTA_MECCANICA } from "../../../lib/puntiVendita/analisi";
import { useAncoraggio } from "./ancoraggio";
import {
  ariaSortElenco,
  type ColonnaElenco,
  conteggioRuolo,
  csvConfronto,
  descrizioneRuolo,
  descriviPresenze,
  facceConfronto,
  filtraConfronto,
  grigliaVolantini,
  type GrigliaVolantini,
  lineeInVista,
  nomeCasella,
  ordinaElenco,
  ordinamentoElencoDaIndirizzo,
  ordinamentoElencoInIndirizzo,
  percentualeDi,
  plurale,
  prezziPerLuogo,
  prodottiConfronto,
  type ProdottoConfronto,
  prossimoOrdinamentoElenco,
  ruoliDelProdotto,
  SENZA_REPARTO,
  SENZA_RUOLO,
  sintesiConfronto,
  type SintesiConfronto,
  stessaVista,
  testoPercentuale,
  type VistaConfronto,
  vistaDaIndirizzo,
  vistaInIndirizzo,
} from "./analisi";
import { ID_TUTTI_I_PRODOTTI } from "./IndicePromozione";
import { LogoInsegna } from "./LogoInsegna";
import { SOTTO_LA_BARRA } from "./PannelliAnalisi";
import { Foto, PrezziEPagine, presenzePerCasella, VUOTO } from "./PrezziEPagine";
import { ProdottiInComune } from "./ProdottiInComune";

export interface ConfrontoAssortimentoProps {
  referenze: readonly ReferenzaPromozione[];
  /** I kit mostrati, nell'ordine del dettaglio. */
  kit: readonly KitPromozioneConsultazione[];
  tinta: (idCanale: string) => Tinta;
  /** Per il nome del file Excel. */
  nomePromo: string;
}

const titoloVista = (vista: VistaConfronto | null, griglia: GrigliaVolantini): string => {
  if (!vista) return "Tutti i prodotti";
  switch (vista.tipo) {
    case "base":
      return `In tutti i ${formatNumero(griglia.numeroKit)} volantini`;
    case "marchio":
      return "A marchio del distributore";
    case "fidelity":
      return "Con Prezzo Fidelity";
    case "insegna":
      return `Solo ${griglia.insegne.find(i => i.id === vista.id)?.nome ?? "l'insegna"}`;
    case "area":
      return `Solo ${griglia.aree.find(a => a.id === vista.id)?.nome ?? "l'area"}`;
    case "casella":
      return `Solo ${nomeCasella(griglia, vista.casella)}`;
  }
};

/**
 * "Assortimento a confronto" (spec volantini-pop): i prodotti dei volantini mostrati per insegna e area.
 * In alto tre numeri da leggere senza scegliere nulla (base comune, percentuale a marchio del
 * distributore, percentuale con Prezzo Fidelity), poi in primo piano le schede dei prodotti in comune
 * a tutti i volantini, con i loro filtri, poi la mappa dei prodotti di un solo volantino con ai margini
 * quelli di una sola insegna e di una sola area, infine l'elenco di tutti i prodotti, il dettaglio, in
 * un riquadro di altezza fissa che scorre da sé: ruolo, dove c'è a parole e a pallini, prezzi per
 * luogo, differenza, e per ogni prodotto prezzi e pagine per insegna e area, prima i prezzi diversi.
 * Scegliere un numero porta all'elenco. Vista, punto di vista, ricerca, reparto, ruoli e ordine
 * dell'elenco stanno nell'indirizzo. I numeri sono sui prodotti dei volantini mostrati, con la base
 * scritta: "il 27% dei 433 prodotti è a marchio del distributore".
 */
export function ConfrontoAssortimento({ referenze, kit, tinta, nomePromo }: ConfrontoAssortimentoProps) {
  const [parametri, aggiorna] = useParametriUrl();
  const griglia = useMemo(() => grigliaVolantini(kit), [kit]);
  const prodotti = useMemo(() => prodottiConfronto(referenze, griglia), [referenze, griglia]);
  const sintesi = useMemo(() => sintesiConfronto(prodotti, griglia), [prodotti, griglia]);

  const vista = vistaDaIndirizzo(parametri.get("vista"), griglia);
  const puntoLetto = parametri.get("punto");
  const punto = griglia.insegne.find(i => i.id.toLowerCase() === puntoLetto?.toLowerCase()) ?? null;
  const idElenco = ID_TUTTI_I_PRODOTTI;
  const ancora = useAncoraggio();
  // Fra i numeri e l'elenco ci sono i prodotti in comune e la mappa: scegliendo un numero la pagina porta
  // all'elenco; togliendo la scelta il comando scelto resta dov'era, anche se l'elenco cambia
  const scegli = (scelta: VistaConfronto, comando?: Element | null) => {
    const nuova = stessaVista(scelta, vista) ? null : vistaInIndirizzo(scelta, griglia);
    if (!nuova) ancora(comando ?? null, document.getElementById(idElenco));
    aggiorna({ vista: nuova });
    if (nuova) document.getElementById(idElenco)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  const descrizione =
    kit.length > 1
      ? `${plurale(prodotti.length, "prodotto", "prodotti")} nei ${formatNumero(kit.length)} volantini mostrati: ${plurale(griglia.insegne.length, "insegna", "insegne")} in ${plurale(griglia.aree.length, "area", "aree")}. Le percentuali sono su questi prodotti. Scegli un numero per vedere i suoi prodotti nell'elenco in fondo.`
      : undefined;

  if (kit.length <= 1 || prodotti.length === 0) {
    return (
      <Sezione titolo="Assortimento a confronto">
        {prodotti.length === 0 ? (
          <EmptyState compatta icon="PackageSearch" title="Nessun prodotto riconosciuto" description="Gli insight dei volantini non hanno prodotti da confrontare." />
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            La promozione ha un solo volantino: tutti i suoi {plurale(prodotti.length, "prodotto", "prodotti")} sono lì.
          </p>
        )}
      </Sezione>
    );
  }

  return (
    <Sezione
      titolo="Assortimento a confronto"
      className={SOTTO_LA_BARRA}
      descrizione={descrizione}
      azioni={
        griglia.insegne.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="whitespace-nowrap">Punto di vista</span>
            <FormSelect
              formSelectSize="sm"
              aria-label="Punto di vista"
              className="w-44"
              value={punto?.id ?? ""}
              onChange={evento => aggiorna({ punto: evento.target.value, vista: null })}
            >
              <option value="">Tutte le insegne</option>
              {griglia.insegne.map(insegna => (
                <option key={insegna.id} value={insegna.id}>
                  {insegna.nome}
                </option>
              ))}
            </FormSelect>
          </label>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <NumeriChiave sintesi={sintesi} griglia={griglia} vista={vista} onScegli={scegli} idElenco={idElenco} />
        <ProdottiInComune prodotti={prodotti} griglia={griglia} tinta={tinta} />
        {griglia.esistenti.size > 1 && <MappaEsclusive sintesi={sintesi} griglia={griglia} punto={punto} vista={vista} tinta={tinta} onScegli={scegli} />}
        <Elenco
          id={idElenco}
          prodotti={prodotti}
          griglia={griglia}
          vista={vista}
          punto={punto}
          tinta={tinta}
          nomePromo={nomePromo}
          onMostraTutti={comando => {
            ancora(comando, document.getElementById(idElenco));
            aggiorna({ vista: null });
          }}
        />
      </div>
    </Sezione>
  );
}

/* ---------- Numeri chiave ---------- */

interface NumeriChiaveProps {
  sintesi: SintesiConfronto;
  griglia: GrigliaVolantini;
  vista: VistaConfronto | null;
  /** Il comando scelto resta fermo sullo schermo quando la scelta si toglie. */
  onScegli: (vista: VistaConfronto, comando: Element | null) => void;
  idElenco: string;
}

const CLASSI_RIQUADRO =
  "flex min-w-0 flex-col gap-3 rounded-card border bg-white p-4 transition-colors dark:bg-darkmode-600 scroll-mt-[9.5rem]";
const riquadroAttivo = (attivo: boolean) =>
  attivo ? "border-theme-1 ring-1 ring-theme-1 dark:border-indigo-300 dark:ring-indigo-300" : "border-slate-200 dark:border-darkmode-400";

/** Un numero chiave: etichetta e icona, il valore grande con la frase, il dettaglio e il comando che apre l'elenco. */
function Riquadro({
  etichetta,
  icona,
  valore,
  frase,
  vuoto,
  attivo,
  onScegli,
  idElenco,
  children,
}: {
  etichetta: string;
  icona: string;
  /** Già scritto: un numero o una percentuale. */
  valore: string;
  frase: string;
  /** Nessun prodotto: il comando non apre l'elenco. */
  vuoto: boolean;
  attivo: boolean;
  onScegli: (comando: Element | null) => void;
  idElenco: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={`${valore} ${frase}`} className={twMerge(CLASSI_RIQUADRO, riquadroAttivo(attivo))}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{etichetta}</span>
        <span aria-hidden="true" className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-theme-1/10 text-theme-1 dark:bg-indigo-300/15 dark:text-indigo-200">
          <Lucide icon={icona} className="h-4 w-4" />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums text-theme-1 dark:text-indigo-200">{valore}</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{frase}</span>
      </div>
      <div className="flex-1">{children}</div>
      <button
        type="button"
        aria-pressed={attivo}
        aria-controls={idElenco}
        disabled={vuoto}
        onClick={evento => onScegli(evento.currentTarget)}
        className="inline-flex items-center gap-1 self-start rounded-control text-sm font-semibold text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 disabled:cursor-default disabled:text-slate-400 disabled:no-underline dark:text-indigo-200"
      >
        {attivo ? "Mostra tutti i prodotti" : "Vedi i prodotti"}
        <Lucide icon={attivo ? "X" : "ArrowDown"} aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}

/** Una barra di quota, con la frase sotto. */
function Quota({ valore, totale, testo }: { valore: number; totale: number; testo: string }) {
  const quota = totale > 0 ? (valore / totale) * 100 : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400">
        <div className="h-full rounded-full bg-theme-1 dark:bg-indigo-300" style={{ width: `${Math.max(quota, valore > 0 ? 2 : 0)}%` }} />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{testo}</span>
    </div>
  );
}

/** Una riga delle linee: nome, barra in scala con le altre, percentuale sui prodotti a marchio e numero dei prodotti. */
function RigaLinea({ nome, prodotti, massimo, aMarchio, altre = false }: { nome: string; prodotti: number; massimo: number; aMarchio: number; altre?: boolean }) {
  return (
    <li
      aria-label={`${nome}: ${testoPercentuale(prodotti, aMarchio)} dei prodotti a marchio, ${plurale(prodotti, "prodotto", "prodotti")}`}
      className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-2 px-1.5 text-xs"
    >
      <span title={nome} className={twMerge("truncate", altre ? "italic text-slate-500 dark:text-slate-400" : "text-slate-700 dark:text-slate-200")}>
        {nome}
      </span>
      <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400">
        <span
          className={twMerge("block h-full rounded-full", altre ? "bg-slate-300 dark:bg-darkmode-300" : "bg-theme-1/70 dark:bg-indigo-300/80")}
          style={{ width: `${(prodotti / massimo) * 100}%` }}
        />
      </span>
      <span aria-hidden="true" className="flex items-baseline justify-end gap-1.5 whitespace-nowrap tabular-nums">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{testoPercentuale(prodotti, aMarchio)}</span>
        <span className="text-2xs text-slate-500 dark:text-slate-400">{formatNumero(prodotti)}</span>
      </span>
    </li>
  );
}

/**
 * Le linee del distributore dei prodotti a marchio: le LINEE_IN_VISTA con più prodotti, ciascuna con la
 * sua percentuale sui soli prodotti a marchio e il numero dei suoi prodotti, e le altre insieme.
 */
function QuoteLinee({ linee, aMarchio }: { linee: SintesiConfronto["perLinea"]; aMarchio: number }) {
  if (linee.length === 0) return null;
  const { linee: inVista, altre } = lineeInVista(linee);
  const massimo = Math.max(1, ...inVista.map(voce => voce.prodotti), altre?.prodotti ?? 0);
  return (
    <div className="mt-3 flex flex-col gap-1">
      <p className="px-1.5 text-2xs font-medium text-slate-500 dark:text-slate-400">Linee, sui {plurale(aMarchio, "prodotto", "prodotti")} a marchio</p>
      <ul aria-label="Prodotti a marchio per linea" className="flex flex-col gap-1">
        {inVista.map(voce => (
          <RigaLinea key={voce.linea} nome={voce.linea} prodotti={voce.prodotti} massimo={massimo} aMarchio={aMarchio} />
        ))}
        {altre && (
          <RigaLinea
            nome={altre.linee === 1 ? "un'altra linea" : `altre ${formatNumero(altre.linee)} linee`}
            prodotti={altre.prodotti}
            massimo={massimo}
            aMarchio={aMarchio}
            altre
          />
        )}
      </ul>
    </div>
  );
}

/** Due parti di una sola barra: i prodotti con Prezzo Fidelity e il resto, ciascuna con la sua percentuale. */
function FidelityEResto({ fidelity, totale }: { fidelity: number; totale: number }) {
  const quota = percentualeDi(fidelity, totale);
  const resto = totale - fidelity;
  return (
    <div className="flex flex-col gap-1.5">
      <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-darkmode-300">
        <div className="h-full bg-theme-1 dark:bg-indigo-300" style={{ width: `${Math.max(quota, fidelity > 0 ? 2 : 0)}%` }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-theme-1 dark:bg-indigo-300" />
          {plurale(fidelity, "prodotto", "prodotti")} Fidelity
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-300 dark:bg-darkmode-300" />
          il resto: {testoPercentuale(resto, totale)}, {plurale(resto, "prodotto", "prodotti")}
        </span>
      </div>
    </div>
  );
}

/**
 * I tre numeri del confronto, sui prodotti diversi dei volantini mostrati, con la base scritta: la base
 * comune, "il 27% dei 433 prodotti è a marchio del distributore" con le sue linee e "il 59% dei 433
 * prodotti ha il Prezzo Fidelity" rispetto al resto. Ognuno apre i suoi prodotti nell'elenco.
 */
function NumeriChiave({ sintesi, griglia, vista, onScegli, idElenco }: NumeriChiaveProps) {
  const { totale } = sintesi;
  const quotaMarchio = percentualeDi(sintesi.aMarchio, totale);
  const deiProdotti = `dei ${plurale(totale, "prodotto", "prodotti")}`;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Riquadro
        etichetta="Base comune"
        icona="Layers"
        valore={formatNumero(sintesi.base)}
        frase={`in tutti i ${formatNumero(griglia.numeroKit)} volantini`}
        vuoto={sintesi.base === 0}
        attivo={vista?.tipo === "base"}
        onScegli={comando => onScegli({ tipo: "base" }, comando)}
        idElenco={idElenco}
      >
        <Quota valore={sintesi.base} totale={totale} testo={`${testoPercentuale(sintesi.base, totale)} ${deiProdotti} dei volantini mostrati`} />
      </Riquadro>
      <Riquadro
        etichetta="A marchio"
        icona="BadgeCheck"
        valore={testoPercentuale(sintesi.aMarchio, totale)}
        frase={`${deiProdotti} è a marchio del distributore`}
        vuoto={sintesi.aMarchio === 0}
        attivo={vista?.tipo === "marchio"}
        onScegli={comando => onScegli({ tipo: "marchio" }, comando)}
        idElenco={idElenco}
      >
        <Quota
          valore={sintesi.aMarchio}
          totale={totale}
          testo={
            sintesi.aMarchio > 0
              ? `${plurale(sintesi.aMarchio, "prodotto", "prodotti")} a marchio su ${formatNumero(totale)} · il resto ${formatPercentuale(100 - quotaMarchio)}`
              : "Nessun prodotto a marchio del distributore"
          }
        />
        <QuoteLinee linee={sintesi.perLinea} aMarchio={sintesi.aMarchio} />
      </Riquadro>
      <Riquadro
        etichetta="Prodotti Fidelity"
        icona="Tag"
        valore={testoPercentuale(sintesi.fidelity, totale)}
        frase={`${deiProdotti} ha il Prezzo Fidelity`}
        vuoto={sintesi.fidelity === 0}
        attivo={vista?.tipo === "fidelity"}
        onScegli={comando => onScegli({ tipo: "fidelity" }, comando)}
        idElenco={idElenco}
      >
        <FidelityEResto fidelity={sintesi.fidelity} totale={totale} />
      </Riquadro>
    </div>
  );
}

/* ---------- Mappa dei prodotti di un solo volantino ---------- */

const CLASSI_NUMERO_MAPPA =
  "flex w-full flex-col items-center rounded-control px-2 py-1.5 text-base font-bold text-slate-800 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-slate-100 dark:hover:bg-indigo-300/15";

/** Un numero della mappa che apre i suoi prodotti nell'elenco; i margini sono su un fondo diverso dalle caselle. */
function NumeroMappa({
  numero,
  sotto,
  etichetta,
  attivo,
  margine = false,
  onScegli,
}: {
  numero: number;
  sotto: string;
  etichetta: string;
  attivo: boolean;
  margine?: boolean;
  onScegli: () => void;
}) {
  return (
    <button
      type="button"
      disabled={numero === 0}
      aria-pressed={attivo}
      aria-label={etichetta}
      onClick={onScegli}
      className={twMerge(
        CLASSI_NUMERO_MAPPA,
        numero === 0
          ? "bg-transparent font-medium text-slate-400 hover:bg-transparent dark:text-slate-500"
          : margine
            ? "bg-theme-1/5 dark:bg-indigo-300/10"
            : "bg-slate-50 dark:bg-darkmode-700",
        attivo && "bg-theme-1 text-white hover:bg-theme-1 dark:bg-indigo-300 dark:text-slate-900"
      )}
    >
      {formatNumero(numero)}
      <span className={twMerge("text-2xs font-medium", attivo ? "text-white/80 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400")}>{sotto}</span>
    </button>
  );
}

/**
 * La mappa insegne × aree dei prodotti di un solo volantino, con ai margini i prodotti di una sola
 * insegna (a destra di ogni riga) e di una sola area (in fondo a ogni colonna). Dal punto di vista di
 * un'insegna resta la sua riga: il margine è il numero delle sue esclusive.
 */
function MappaEsclusive({
  sintesi,
  griglia,
  punto,
  vista,
  tinta,
  onScegli,
}: {
  sintesi: SintesiConfronto;
  griglia: GrigliaVolantini;
  punto: Riferimento | null;
  vista: VistaConfronto | null;
  tinta: (idCanale: string) => Tinta;
  onScegli: (vista: VistaConfronto) => void;
}) {
  const n = griglia.aree.length;
  const perInsegna = new Map(sintesi.perInsegna.map(voce => [voce.insegna.id, voce.prodotti]));
  const perArea = new Map(sintesi.perArea.map(voce => [voce.area.id, voce.prodotti]));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="title-card dark:text-slate-200">Prodotti di un solo volantino</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          In ogni casella i prodotti che escono solo in quel volantino; ai margini quelli di una sola insegna e di una sola area. Scegline uno per vederli.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 tabular-nums" aria-label="Prodotti di un solo volantino, per insegna e area">
          <thead>
            <tr>
              <td />
              {griglia.aree.map(area => (
                <th key={area.id} scope="col" className="whitespace-nowrap px-2 pb-1 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                  {area.nome}
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap px-2 pb-1 text-center text-xs font-semibold text-theme-1 dark:text-indigo-200">
                Solo l&apos;insegna
              </th>
            </tr>
          </thead>
          <tbody>
            {griglia.insegne.map((insegna, a) => {
              if (punto && punto.id !== insegna.id) return null;
              const esclusive = perInsegna.get(insegna.id) ?? 0;
              return (
                <tr key={insegna.id}>
                  <th scope="row" className="whitespace-nowrap pr-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <span className="inline-flex items-center gap-1.5">
                      <LogoInsegna idCanale={insegna.id} nome={insegna.nome} tinta={tinta(insegna.id)} />
                      {insegna.nome}
                    </span>
                  </th>
                  {griglia.aree.map((area, b) => {
                    const casella = a * n + b;
                    if (!griglia.esistenti.has(casella)) {
                      return (
                        <td key={area.id} className="min-w-[4.5rem] text-center text-sm text-slate-300 dark:text-slate-600" title={`${insegna.nome} non ha un volantino in ${area.nome}`}>
                          {VUOTO}
                        </td>
                      );
                    }
                    const numero = sintesi.perCasella.get(casella) ?? 0;
                    return (
                      <td key={area.id} className="min-w-[4.5rem]">
                        <NumeroMappa
                          numero={numero}
                          sotto="solo qui"
                          etichetta={`${plurale(numero, "prodotto", "prodotti")} solo in ${insegna.nome} · ${area.nome}`}
                          attivo={vista?.tipo === "casella" && vista.casella === casella}
                          onScegli={() => onScegli({ tipo: "casella", casella })}
                        />
                      </td>
                    );
                  })}
                  <td className="min-w-[5.5rem] border-l border-dashed border-slate-200 pl-1 dark:border-darkmode-400">
                    <NumeroMappa
                      numero={esclusive}
                      sotto={`solo ${insegna.nome}`}
                      etichetta={`${plurale(esclusive, "prodotto", "prodotti")} solo ${insegna.nome}`}
                      attivo={vista?.tipo === "insegna" && vista.id === insegna.id}
                      margine
                      onScegli={() => onScegli({ tipo: "insegna", id: insegna.id })}
                    />
                  </td>
                </tr>
              );
            })}
            {!punto && (
              <tr>
                <th scope="row" className="whitespace-nowrap pr-3 pt-1 text-left text-xs font-semibold text-theme-1 dark:text-indigo-200">
                  Solo l&apos;area
                </th>
                {griglia.aree.map(area => {
                  const esclusive = perArea.get(area.id) ?? 0;
                  return (
                    <td key={area.id} className="min-w-[4.5rem] border-t border-dashed border-slate-200 pt-1 dark:border-darkmode-400">
                      <NumeroMappa
                        numero={esclusive}
                        sotto={`solo ${area.nome}`}
                        etichetta={`${plurale(esclusive, "prodotto", "prodotti")} solo ${area.nome}`}
                        attivo={vista?.tipo === "area" && vista.id === area.id}
                        margine
                        onScegli={() => onScegli({ tipo: "area", id: area.id })}
                      />
                    </td>
                  );
                })}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Elenco ---------- */

interface ElencoProps {
  id: string;
  prodotti: readonly ProdottoConfronto[];
  griglia: GrigliaVolantini;
  vista: VistaConfronto | null;
  punto: Riferimento | null;
  tinta: (idCanale: string) => Tinta;
  nomePromo: string;
  /** Torna a tutti i prodotti; il comando scelto resta fermo sullo schermo. */
  onMostraTutti: (comando: Element | null) => void;
}

/** Le intestazioni che riordinano l'elenco, con il loro nome; la colonna Ruolo sta fra la prima e la seconda. */
const INTESTAZIONI: ReadonlyArray<{ colonna: ColonnaElenco; etichetta: string }> = [
  { colonna: "prodotto", etichetta: "Prodotto" },
  { colonna: "volantini", etichetta: "In quali volantini" },
  { colonna: "prezzo", etichetta: "Prezzo" },
  { colonna: "differenza", etichetta: "Differenza" },
];

const ICONA_VERSO = { ascending: "ArrowUp", descending: "ArrowDown", none: "ChevronsUpDown" } as const;

/**
 * L'elenco di tutti i prodotti (spec volantini-pop): ricerca, reparto e ruoli (a scelta multipla, con i
 * loro conteggi) fuori dal riquadro, con le voci che seguono gli altri filtri; il riquadro scorre da sé.
 * All'apertura prima i prezzi diversi, poi per nome; scegliendo un'intestazione (prodotto, volantini,
 * prezzo, differenza) si riordina e di nuovo si inverte, con l'ordine in ?ordina=. Niente tendina
 * dell'ordine né filtro dei soli prezzi diversi.
 */
function Elenco({ id, prodotti, griglia, vista, punto, tinta, nomePromo, onMostraTutti }: ElencoProps) {
  const [parametri, aggiorna] = useParametriUrl();
  const cerca = parametri.get("cerca") ?? "";
  const reparto = parametri.get("reparto") || null;
  const testoRuoli = parametri.get("ruolo");
  const ruoli = useMemo(() => ruoliDaIndirizzo(testoRuoli), [testoRuoli]);
  const ordinamento = ordinamentoElencoDaIndirizzo(parametri.get("ordina"));
  const [testoRicerca, setTestoRicerca] = useRicercaDifferita(cerca, testo => aggiorna({ cerca: testo }));
  const [aperti, setAperti] = useState<ReadonlySet<string>>(new Set());
  const riquadro = useRef<HTMLDivElement>(null);
  const radice = useRef<HTMLDivElement>(null);

  const filtro = useMemo(() => ({ vista, punto: punto?.id ?? null, cerca, reparto, ruoli }), [vista, punto, cerca, reparto, ruoli]);
  // Le voci dei filtri seguono gli altri filtri: scelto un ruolo, solo i reparti che lo hanno
  const facce = useMemo(() => facceConfronto(prodotti, griglia, filtro), [prodotti, griglia, filtro]);
  // Tutti i ruoli dei prodotti, anche quelli esclusi dagli altri filtri: dicono se la colonna serve
  const conRuoli = useMemo(() => prodotti.some(p => (p.referenza.ruoli ?? []).length > 0), [prodotti]);
  const mostrati = useMemo(() => ordinaElenco(filtraConfronto(prodotti, griglia, filtro), ordinamento), [prodotti, griglia, filtro, ordinamento]);
  const titolo = titoloVista(vista, griglia);
  const conFiltri = Boolean(cerca || reparto || ruoli.length > 0);
  // Un'altra scelta o un altro filtro: il riquadro riparte dal primo prodotto
  const scelta = [vista ? vistaInIndirizzo(vista, griglia) : "", punto?.id ?? "", cerca, reparto ?? "", ruoli.join(","), parametri.get("ordina") ?? ""].join("|");
  useEffect(() => {
    if (riquadro.current) riquadro.current.scrollTop = 0;
  }, [scelta]);
  const apriChiudi = (chiave: string) =>
    setAperti(attuali => {
      const prossimi = new Set(attuali);
      if (prossimi.has(chiave)) prossimi.delete(chiave);
      else prossimi.add(chiave);
      return prossimi;
    });
  const scaricaExcel = () => {
    const blob = new Blob([csvConfronto(mostrati, griglia)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `assortimento ${nomePromo}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const vociRuoli = [
    ...facce.ruoli.map(voce => ({ valore: voce.ruolo, etichetta: voce.ruolo, conteggio: voce.prodotti })),
    ...(facce.senzaRuolo > 0 ? [{ valore: SENZA_RUOLO, etichetta: "Senza ruolo", conteggio: facce.senzaRuolo }] : []),
  ];
  const colonne = conRuoli ? 5 : 4;

  return (
    // scroll-mt: la pagina porta l'elenco sotto la barra dei filtri, che resta in alto
    <div ref={radice} id={id} className={twMerge("flex flex-col gap-3 border-t border-dashed border-slate-200 pt-4 dark:border-darkmode-400", SOTTO_LA_BARRA)}>
      {/* Titolo e strumenti stanno sopra il riquadro: restano in vista mentre l'elenco scorre al suo interno */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{titolo}</h3>
          <span aria-live="polite" className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {plurale(mostrati.length, "prodotto", "prodotti")}
            {punto ? ` stampati da ${punto.nome}` : ""}
          </span>
          {vista && (
            <button
              type="button"
              onClick={() => onMostraTutti(radice.current)}
              className="inline-flex items-center gap-1 rounded-full bg-theme-1/10 px-2.5 py-0.5 text-xs font-semibold text-theme-1 hover:bg-theme-1/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:bg-indigo-300/15 dark:text-indigo-200"
            >
              Mostra tutti i prodotti
              <Lucide icon="X" aria-hidden="true" className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CampoRicerca etichetta="Cerca prodotto, marca, codice o EAN" placeholder="Prodotto, marca, codice…" value={testoRicerca} onChange={setTestoRicerca} className="sm:w-64" />
          <FormSelect formSelectSize="sm" aria-label="Reparto" className="sm:w-52" value={reparto ?? ""} onChange={evento => aggiorna({ reparto: evento.target.value })}>
            <option value="">Tutti i reparti</option>
            {/* Un reparto dell'indirizzo che con gli altri filtri non c'è resta visibile, da togliere */}
            {reparto && reparto !== SENZA_REPARTO && !facce.reparti.some(voce => voce.codice === reparto) && <option value={reparto}>{reparto}</option>}
            {facce.reparti.map(voce => (
              <option key={voce.codice} value={voce.codice}>
                {voce.nome}
              </option>
            ))}
            {(facce.senzaReparto || reparto === SENZA_REPARTO) && <option value={SENZA_REPARTO}>Senza reparto</option>}
          </FormSelect>
          <div className="ml-auto flex items-center gap-2">
            {conFiltri && (
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setTestoRicerca("");
                  aggiorna({ cerca: null, reparto: null, ruolo: null });
                }}
              >
                <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Azzera filtri
              </Button>
            )}
            <Button type="button" variant="outline-secondary" size="sm" disabled={mostrati.length === 0} onClick={scaricaExcel}>
              <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Scarica Excel
            </Button>
          </div>
        </div>
        {(conRuoli || ruoli.length > 0) && (
          <SceltaRuoli etichetta="Ruolo" voci={vociRuoli} scelti={ruoli} unita={["prodotto", "prodotti"]} onCambia={scelti => aggiorna({ ruolo: ruoliInIndirizzo(scelti) })} />
        )}
        <Legenda />
      </div>

      {mostrati.length === 0 ? (
        <EmptyState compatta icon="SearchX" title="Nessun prodotto" description="Nessun prodotto corrisponde a questa scelta e ai filtri." />
      ) : (
        // Il dettaglio di tutti i prodotti: un riquadro di altezza fissa che scorre da sé, senza pagine,
        // così la pagina prosegue subito con l'assortimento e il confronto fra i kit
        <div
          ref={riquadro}
          role="region"
          aria-label={`Elenco: ${titolo}`}
          tabIndex={0}
          className="max-h-[min(40rem,70vh)] overflow-auto rounded-card border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:border-darkmode-400"
        >
          <table aria-label={titolo} className="w-full min-w-[48rem] border-collapse text-sm">
            <thead className="sticky top-0 z-[1] bg-white shadow-[inset_0_-1px_0_rgb(226_232_240)] dark:bg-darkmode-600 dark:shadow-[inset_0_-1px_0_rgb(var(--color-darkmode-400))]">
              <tr className="text-left text-2xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {INTESTAZIONI.map(({ colonna, etichetta }) => {
                  const verso = ariaSortElenco(ordinamento, colonna);
                  return (
                    <Fragment key={colonna}>
                      <th scope="col" aria-sort={verso} className="px-3 py-2 font-medium">
                        <button
                          type="button"
                          onClick={() => aggiorna({ ordina: ordinamentoElencoInIndirizzo(prossimoOrdinamentoElenco(ordinamento, colonna)) })}
                          className={twMerge(
                            "inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:hover:text-slate-200",
                            verso !== "none" && "font-semibold text-theme-1 dark:text-indigo-300"
                          )}
                        >
                          {etichetta}
                          <Lucide icon={ICONA_VERSO[verso]} aria-hidden="true" className={twMerge("h-3 w-3", verso === "none" && "opacity-40")} />
                        </button>
                      </th>
                      {colonna === "prodotto" && conRuoli && (
                        <th scope="col" className="px-3 py-2 font-medium">
                          Ruolo
                        </th>
                      )}
                    </Fragment>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {mostrati.map(prodotto => (
                <RigaProdotto
                  key={prodotto.referenza.chiave}
                  prodotto={prodotto}
                  griglia={griglia}
                  tinta={tinta}
                  conRuoli={conRuoli}
                  colonne={colonne}
                  aperta={aperti.has(prodotto.referenza.chiave)}
                  onApriChiudi={() => apriChiudi(prodotto.referenza.chiave)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
      <span className="inline-flex items-center gap-1.5">
        <Pallino stato="presente" /> c'è
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Pallino stato="assente" /> non c'è
      </span>
    </div>
  );
}

/** Solo due stati, c'è e non c'è; "vuota" è la casella insegna × area senza volantino. */
function Pallino({ stato, titolo }: { stato: "presente" | "assente" | "vuota"; titolo?: string }) {
  return (
    <span
      title={titolo}
      aria-hidden="true"
      data-stato={stato}
      className={twMerge(
        "inline-block h-3 w-3 flex-none rounded-full",
        stato === "presente" && "bg-theme-1 dark:bg-indigo-300",
        stato === "assente" && "ring-[1.5px] ring-inset ring-slate-300 dark:ring-darkmode-300",
        stato === "vuota" && "bg-transparent"
      )}
    />
  );
}

const CLASSI_CHIP = "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap";

/** I pallini insegne × aree: c'è oppure non c'è, a qualunque prezzo; il prezzo resta nel suggerimento. */
function GrigliaPallini({ prodotto, griglia }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini }) {
  const n = griglia.aree.length;
  const perCasella = presenzePerCasella(prodotto, griglia);
  return (
    <div
      className="grid w-max items-center gap-x-1 gap-y-0.5 text-2xs text-slate-500 dark:text-slate-400"
      style={{ gridTemplateColumns: `auto repeat(${n}, 0.875rem)` }}
      aria-hidden="true"
    >
      <span />
      {griglia.aree.map(area => (
        <span key={area.id} title={area.nome} className="text-center">
          {area.nome.slice(0, 1)}
        </span>
      ))}
      {griglia.insegne.map((insegna, a) => (
        <Fragment key={insegna.id}>
          <span className="pr-1">{insegna.nome}</span>
          {griglia.aree.map((area, b) => {
            const casella = a * n + b;
            const presenze = perCasella.get(casella);
            if (!griglia.esistenti.has(casella)) return <Pallino key={area.id} stato="vuota" />;
            if (!presenze) return <Pallino key={area.id} stato="assente" titolo={`${insegna.nome} · ${area.nome}: non c'è`} />;
            const presenza = presenze[0];
            const prezzo = presenza?.prezzo ?? null;
            return (
              <Pallino
                key={area.id}
                stato="presente"
                titolo={`${insegna.nome} · ${area.nome}: ${prezzo !== null ? `${formatEuro(prezzo)}${unitaPrezzo(presenza?.prezzoAllEtto)}` : "senza prezzo"}`}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * I ruoli di un prodotto, uno per riga; con più ruoli ciascuno dice in vista in quanti dei volantini
 * in cui il prodotto compare lo ha ("Star 1/3"), con la frase intera nel suggerimento.
 */
function RuoliDelProdotto({ referenza }: { referenza: ReferenzaPromozione }) {
  const ruoli = ruoliDelProdotto(referenza);
  if (ruoli.length === 0) return <span className="text-slate-400 dark:text-slate-500">{VUOTO}</span>;
  return (
    <ul className="flex flex-col items-start gap-1">
      {ruoli.map(voce => {
        const conteggio = conteggioRuolo(voce, ruoli.length);
        return (
          <li key={voce.ruolo} title={descrizioneRuolo(voce, ruoli.length)} className={twMerge(CLASSI_CHIP, "gap-1.5 bg-slate-800 font-semibold text-white dark:bg-slate-200 dark:text-slate-900")}>
            <span>{voce.ruolo}</span>
            {conteggio && <span className="font-normal tabular-nums opacity-80">{conteggio}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function RigaProdotto({
  prodotto,
  griglia,
  tinta,
  conRuoli,
  colonne,
  aperta,
  onApriChiudi,
}: {
  prodotto: ProdottoConfronto;
  griglia: GrigliaVolantini;
  tinta: (idCanale: string) => Tinta;
  /** La colonna Ruolo: solo se qualche prodotto dell'elenco ne ha uno. */
  conRuoli: boolean;
  /** Le colonne della tabella, per il dettaglio che le occupa tutte. */
  colonne: number;
  aperta: boolean;
  onApriChiudi: () => void;
}) {
  const idDettaglio = useId();
  const r = prodotto.referenza;
  const dove = descriviPresenze(prodotto, griglia);
  const prezzi = prezziPerLuogo(prodotto, griglia);
  const sottotitolo = [r.formato, r.codice ? `cod. ${r.codice}` : null].filter(Boolean).join(" · ");
  const classeTd = "border-b border-slate-100 px-3 py-2 align-top dark:border-darkmode-400";

  return (
    <>
      <tr className="[&:hover>td]:bg-slate-50 dark:[&:hover>td]:bg-darkmode-400/40">
        <td className={classeTd}>
          <div className="flex gap-3">
            <Foto key={r.foto ?? ""} url={r.foto} className="h-10 w-10" />
            <div className="min-w-0">
              <p className="font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
                {r.nome || "Prodotto senza nome"}
                {r.marca && <strong className="ml-1 font-extrabold">{r.marca}</strong>}
              </p>
              {sottotitolo && <p className="text-xs text-slate-500 dark:text-slate-400">{sottotitolo}</p>}
              {r.prezzoAlKg && <p className="text-xs text-slate-500 dark:text-slate-400">{r.prezzoAlKg}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                <span className={twMerge(CLASSI_CHIP, "bg-slate-100 text-slate-700 dark:bg-darkmode-400 dark:text-slate-200")}>
                  {r.reparto ? r.reparto.descrizione || r.reparto.codice : "Senza reparto"}
                </span>
                {/* Il ?? tiene in piedi l'elenco con un server che non manda ancora i dati minimi */}
                {(r.meccaniche ?? []).map(meccanica => (
                  <span key={meccanica} className={twMerge(CLASSI_CHIP, "bg-theme-1/10 font-semibold text-theme-1 dark:bg-indigo-300/15 dark:text-indigo-200")}>
                    {ETICHETTA_MECCANICA[meccanica]}
                  </span>
                ))}
                {r.linea && <span className={twMerge(CLASSI_CHIP, "text-slate-600 ring-1 ring-inset ring-slate-200 dark:text-slate-300 dark:ring-darkmode-300")}>{r.linea}</span>}
                {r.sottocosto && <span className={twMerge(CLASSI_CHIP, "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300")}>Sottocosto</span>}
              </div>
              {/* Il comando sta nella cella del prodotto: una colonna in meno, e l'elenco non si taglia sugli schermi medi */}
              <button
                type="button"
                aria-expanded={aperta}
                aria-controls={aperta ? idDettaglio : undefined}
                onClick={onApriChiudi}
                className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-control text-xs font-semibold text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-indigo-200"
              >
                Prezzi e pagine
                <Lucide icon={aperta ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </td>
        {conRuoli && (
          <td className={twMerge(classeTd, "whitespace-nowrap")}>
            <RuoliDelProdotto referenza={r} />
          </td>
        )}
        <td className={classeTd}>
          <p className={twMerge("mb-1.5 font-semibold", dove.eccezione ? "text-cyan-700 dark:text-cyan-300" : "text-slate-700 dark:text-slate-200")}>{dove.testo}</p>
          <GrigliaPallini prodotto={prodotto} griglia={griglia} />
        </td>
        <td className={twMerge(classeTd, "tabular-nums")}>
          {prezzi.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500">Prezzo non indicato</span>
          ) : prezzi.length === 1 ? (
            <>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {formatEuro(prezzi[0]?.prezzo)}
                {prezzi[0]?.allEtto && <span className="font-normal text-slate-500 dark:text-slate-400">{unitaPrezzo(true)}</span>}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {prodotto.numeroKit === 1 ? "in questo volantino" : `uguale in ${prodotto.numeroKit >= griglia.numeroKit ? "tutti i" : "tutti i suoi"} ${formatNumero(prodotto.numeroKit)} volantini`}
              </p>
            </>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {prezzi.map(voce => (
                <li key={voce.prezzo} className={twMerge("whitespace-nowrap", voce.piuAlto ? "font-semibold text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-slate-100")}>
                  {formatEuro(voce.prezzo)}
                  {unitaPrezzo(voce.allEtto)} <span className="font-normal text-slate-500 dark:text-slate-400">{voce.luogo}</span>
                </li>
              ))}
            </ul>
          )}
        </td>
        <td className={twMerge(classeTd, "tabular-nums")}>
          {prodotto.differenza > 0 ? (
            <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
              +{formatEuro(prodotto.differenza)} · +{formatPercentuale(prodotto.percentuale)}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{VUOTO}</span>
          )}
        </td>
      </tr>
      {aperta && (
        <tr>
          <td colSpan={colonne} id={idDettaglio} className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-darkmode-400 dark:bg-darkmode-700">
            <PrezziEPagine prodotto={prodotto} griglia={griglia} tinta={tinta} />
          </td>
        </tr>
      )}
    </>
  );
}

export default ConfrontoAssortimento;
