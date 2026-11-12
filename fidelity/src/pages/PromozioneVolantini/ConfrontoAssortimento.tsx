import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormCheck, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";
import type { Tinta } from "@/components/Grafici";
import { NOTA_PREZZO_CALCOLATO } from "@/components/FlyerInsights/volantino/box";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { Fragment, useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { KitPromozioneConsultazione, PresenzaReferenzaPromozione, ReferenzaPromozione, Riferimento } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import { ETICHETTA_MECCANICA } from "../../../lib/puntiVendita/analisi";
import {
  csvConfronto,
  descriviPresenze,
  filtraConfronto,
  grigliaVolantini,
  type GrigliaVolantini,
  nomeCasella,
  ORDINI_CONFRONTO,
  ordinaConfronto,
  ordineDaIndirizzo,
  plurale,
  prezziPerLuogo,
  prodottiConfronto,
  type ProdottoConfronto,
  repartiDelConfronto,
  SENZA_REPARTO,
  sintesiConfronto,
  type SintesiConfronto,
  stessaVista,
  type VistaConfronto,
  vistaDaIndirizzo,
  vistaInIndirizzo,
} from "./analisi";
import { LogoInsegna } from "./LogoInsegna";

export interface ConfrontoAssortimentoProps {
  referenze: readonly ReferenzaPromozione[];
  /** I kit mostrati, nell'ordine del dettaglio. */
  kit: readonly KitPromozioneConsultazione[];
  tinta: (idCanale: string) => Tinta;
  /** Per il nome del file Excel. */
  nomePromo: string;
}

const VUOTO = "—";

const titoloVista = (vista: VistaConfronto | null, griglia: GrigliaVolantini): string => {
  if (!vista) return "Tutti i prodotti";
  switch (vista.tipo) {
    case "base":
      return `In tutti i ${formatNumero(griglia.numeroKit)} volantini`;
    case "prezzi":
      return "Con prezzo diverso fra i volantini";
    case "insegne":
      return "Di una sola insegna";
    case "aree":
      return "Di una sola area";
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
 * In alto quattro numeri da leggere senza scegliere nulla (base comune, prezzi diversi, una sola
 * insegna, una sola area), poi la mappa dei prodotti di un solo volantino, poi l'elenco subito sotto:
 * dove c'è a parole e a pallini, prezzi per luogo, differenza, e per ogni prodotto prezzi e pagine per
 * insegna e area. Vista, punto di vista, ricerca, reparto, "solo diversi" e ordine stanno nell'indirizzo.
 */
export function ConfrontoAssortimento({ referenze, kit, tinta, nomePromo }: ConfrontoAssortimentoProps) {
  const [parametri, aggiorna] = useParametriUrl();
  const griglia = useMemo(() => grigliaVolantini(kit), [kit]);
  const prodotti = useMemo(() => prodottiConfronto(referenze, griglia), [referenze, griglia]);
  const sintesi = useMemo(() => sintesiConfronto(prodotti, griglia), [prodotti, griglia]);

  const vista = vistaDaIndirizzo(parametri.get("vista"), griglia);
  const puntoLetto = parametri.get("punto");
  const punto = griglia.insegne.find(i => i.id.toLowerCase() === puntoLetto?.toLowerCase()) ?? null;
  const scegli = (scelta: VistaConfronto) => aggiorna({ vista: stessaVista(scelta, vista) ? null : vistaInIndirizzo(scelta, griglia) });
  const idElenco = useId();

  const descrizione =
    kit.length > 1
      ? `${plurale(prodotti.length, "prodotto", "prodotti")} nei ${formatNumero(kit.length)} volantini mostrati: ${plurale(griglia.insegne.length, "insegna", "insegne")} in ${plurale(griglia.aree.length, "area", "aree")}. Scegli un numero: l'elenco si apre qui sotto.`
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
        <NumeriChiave sintesi={sintesi} griglia={griglia} punto={punto} vista={vista} tinta={tinta} onScegli={scegli} idElenco={idElenco} />
        {griglia.esistenti.size > 1 && <MappaEsclusive sintesi={sintesi} griglia={griglia} punto={punto} vista={vista} tinta={tinta} onScegli={scegli} />}
        <Elenco
          id={idElenco}
          prodotti={prodotti}
          griglia={griglia}
          vista={vista}
          punto={punto}
          tinta={tinta}
          nomePromo={nomePromo}
          onMostraTutti={() => aggiorna({ vista: null })}
        />
      </div>
    </Sezione>
  );
}

/* ---------- Numeri chiave ---------- */

interface NumeriChiaveProps {
  sintesi: SintesiConfronto;
  griglia: GrigliaVolantini;
  punto: Riferimento | null;
  vista: VistaConfronto | null;
  tinta: (idCanale: string) => Tinta;
  onScegli: (vista: VistaConfronto) => void;
  idElenco: string;
}

const CLASSI_RIQUADRO =
  "flex min-w-0 flex-col gap-3 rounded-card border bg-white p-4 transition-colors dark:bg-darkmode-600";
const riquadroAttivo = (attivo: boolean) =>
  attivo ? "border-theme-1 ring-1 ring-theme-1 dark:border-indigo-300 dark:ring-indigo-300" : "border-slate-200 dark:border-darkmode-400";

/** Un numero chiave: etichetta e icona, il numero grande con la frase, il dettaglio e il comando che apre l'elenco. */
function Riquadro({
  etichetta,
  icona,
  numero,
  frase,
  attivo,
  onScegli,
  comando,
  idElenco,
  tono = "theme",
  children,
}: {
  etichetta: string;
  icona: string;
  numero: number;
  frase: string;
  attivo: boolean;
  onScegli: () => void;
  comando: string;
  idElenco: string;
  tono?: "theme" | "amber";
  children: ReactNode;
}) {
  return (
    <section aria-label={`${formatNumero(numero)} ${frase}`} className={twMerge(CLASSI_RIQUADRO, riquadroAttivo(attivo))}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{etichetta}</span>
        <span
          aria-hidden="true"
          className={twMerge(
            "flex h-7 w-7 flex-none items-center justify-center rounded-full",
            tono === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" : "bg-theme-1/10 text-theme-1 dark:bg-indigo-300/15 dark:text-indigo-200"
          )}
        >
          <Lucide icon={icona} className="h-4 w-4" />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={twMerge("text-3xl font-extrabold tabular-nums", tono === "amber" ? "text-amber-700 dark:text-amber-300" : "text-theme-1 dark:text-indigo-200")}>
          {formatNumero(numero)}
        </span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{frase}</span>
      </div>
      <div className="flex-1">{children}</div>
      <button
        type="button"
        aria-pressed={attivo}
        aria-controls={idElenco}
        disabled={numero === 0}
        onClick={onScegli}
        className="inline-flex items-center gap-1 self-start rounded-control text-sm font-semibold text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 disabled:cursor-default disabled:text-slate-400 disabled:no-underline dark:text-indigo-200"
      >
        {attivo ? "Mostra tutti i prodotti" : comando}
        <Lucide icon={attivo ? "X" : "ArrowDown"} aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </section>
  );
}

/** Una barra di quota, con la percentuale. */
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

/** Le righe di un dettaglio per insegna o per area: nome, barra in scala con le altre righe, numero; ogni riga apre i suoi prodotti. */
function Ripartizione({
  voci,
  onScegli,
  attiva,
}: {
  voci: Array<{ id: string; nome: string; numero: number; segno?: ReactNode }>;
  onScegli: (id: string) => void;
  attiva: string | null;
}) {
  const massimo = Math.max(1, ...voci.map(v => v.numero));
  return (
    <ul className="flex flex-col gap-1">
      {voci.map(voce => (
        <li key={voce.id}>
          <button
            type="button"
            disabled={voce.numero === 0}
            aria-pressed={attiva === voce.id}
            onClick={() => onScegli(voce.id)}
            className={twMerge(
              "grid w-full grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_2.5rem] items-center gap-2 rounded-control px-1.5 py-1 text-left text-xs hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-darkmode-400",
              attiva === voce.id && "bg-theme-1/10 dark:bg-indigo-300/15"
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-slate-700 dark:text-slate-200">
              {voce.segno}
              <span className="truncate">{voce.nome}</span>
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-darkmode-400">
              <span className="block h-full rounded-full bg-theme-1/70 dark:bg-indigo-300/80" style={{ width: `${(voce.numero / massimo) * 100}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{formatNumero(voce.numero)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function NumeriChiave({ sintesi, griglia, punto, vista, tinta, onScegli, idElenco }: NumeriChiaveProps) {
  const totaleInsegne = sintesi.perInsegna.reduce((t, v) => t + v.prodotti, 0);
  const totaleAree = sintesi.perArea.reduce((t, v) => t + v.prodotti, 0);
  const distante = sintesi.piuDistante;
  const delPunto = punto ? sintesi.perInsegna.find(v => v.insegna.id === punto.id)?.prodotti ?? 0 : 0;
  const attivaInsegna = vista?.tipo === "insegna" ? vista.id : null;
  const attivaArea = vista?.tipo === "area" ? vista.id : null;
  const voceInsegna = (v: SintesiConfronto["perInsegna"][number]) => ({
    id: v.insegna.id,
    nome: v.insegna.nome,
    numero: v.prodotti,
    segno: <LogoInsegna idCanale={v.insegna.id} nome={v.insegna.nome} tinta={tinta(v.insegna.id)} />,
  });

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Riquadro
        etichetta="Base comune"
        icona="Layers"
        numero={sintesi.base}
        frase={`in tutti i ${formatNumero(griglia.numeroKit)} volantini`}
        attivo={vista?.tipo === "base"}
        onScegli={() => onScegli({ tipo: "base" })}
        comando="Vedi i prodotti"
        idElenco={idElenco}
      >
        <Quota valore={sintesi.base} totale={sintesi.totale} testo={`${formatPercentuale(Math.round((sintesi.base / Math.max(1, sintesi.totale)) * 100))} dei ${formatNumero(sintesi.totale)} prodotti della promozione`} />
      </Riquadro>
      <Riquadro
        etichetta="Prezzi non allineati"
        icona="Scale"
        tono="amber"
        numero={sintesi.prezziDiversi}
        frase="con prezzo diverso fra i volantini"
        attivo={vista?.tipo === "prezzi"}
        onScegli={() => onScegli({ tipo: "prezzi" })}
        comando="Vedi i prodotti"
        idElenco={idElenco}
      >
        <div className="flex flex-col gap-1.5">
          <Quota valore={sintesi.prezziDiversi} totale={sintesi.totale} testo={`${formatPercentuale(Math.round((sintesi.prezziDiversi / Math.max(1, sintesi.totale)) * 100))} dei prodotti`} />
          {distante && distante.min !== null && distante.max !== null && (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Il più distante: <span className="font-semibold">{[distante.referenza.nome, distante.referenza.marca].filter(Boolean).join(" ")}</span>, da {formatEuro(distante.min)} a{" "}
              {formatEuro(distante.max)} (+{formatPercentuale(distante.percentuale)})
            </p>
          )}
        </div>
      </Riquadro>
      {punto ? (
        <Riquadro
          etichetta="Esclusivi dell'insegna"
          icona="Store"
          numero={delPunto}
          frase={`solo ${punto.nome}`}
          attivo={vista?.tipo === "insegna" && vista.id === punto.id}
          onScegli={() => onScegli({ tipo: "insegna", id: punto.id })}
          comando="Vedi i prodotti"
          idElenco={idElenco}
        >
          <Ripartizione voci={sintesi.perInsegna.map(voceInsegna)} attiva={attivaInsegna} onScegli={id => onScegli({ tipo: "insegna", id })} />
        </Riquadro>
      ) : (
        <Riquadro
          etichetta="Esclusivi di un'insegna"
          icona="Store"
          numero={totaleInsegne}
          frase="di una sola insegna"
          attivo={vista?.tipo === "insegne"}
          onScegli={() => onScegli({ tipo: "insegne" })}
          comando="Vedi tutti"
          idElenco={idElenco}
        >
          <Ripartizione voci={sintesi.perInsegna.map(voceInsegna)} attiva={attivaInsegna} onScegli={id => onScegli({ tipo: "insegna", id })} />
        </Riquadro>
      )}
      <Riquadro
        etichetta="Esclusivi di un'area"
        icona="MapPin"
        numero={totaleAree}
        frase="di una sola area"
        attivo={vista?.tipo === "aree"}
        onScegli={() => onScegli({ tipo: "aree" })}
        comando="Vedi tutti"
        idElenco={idElenco}
      >
        <Ripartizione
          voci={[...sintesi.perArea].sort((a, b) => b.prodotti - a.prodotti).map(v => ({ id: v.area.id, nome: v.area.nome, numero: v.prodotti }))}
          attiva={attivaArea}
          onScegli={id => onScegli({ tipo: "area", id })}
        />
      </Riquadro>
    </div>
  );
}

/* ---------- Mappa dei prodotti di un solo volantino ---------- */

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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="title-card dark:text-slate-200">Prodotti di un solo volantino</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">In ogni casella i prodotti che escono solo in quel volantino: scegline una per vederli.</p>
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
            </tr>
          </thead>
          <tbody>
            {griglia.insegne.map((insegna, a) => {
              if (punto && punto.id !== insegna.id) return null;
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
                    const attiva = vista?.tipo === "casella" && vista.casella === casella;
                    return (
                      <td key={area.id} className="min-w-[4.5rem]">
                        <button
                          type="button"
                          disabled={numero === 0}
                          aria-pressed={attiva}
                          aria-label={`${plurale(numero, "prodotto", "prodotti")} solo in ${insegna.nome} · ${area.nome}`}
                          onClick={() => onScegli({ tipo: "casella", casella })}
                          className={twMerge(
                            "flex w-full flex-col items-center rounded-control px-2 py-1.5 text-base font-bold text-slate-800 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-slate-100 dark:hover:bg-indigo-300/15",
                            numero === 0 ? "bg-transparent font-medium text-slate-400 hover:bg-transparent dark:text-slate-500" : "bg-slate-50 dark:bg-darkmode-700",
                            attiva && "bg-theme-1 text-white hover:bg-theme-1 dark:bg-indigo-300 dark:text-slate-900"
                          )}
                        >
                          {formatNumero(numero)}
                          <span className={twMerge("text-2xs font-medium", attiva ? "text-white/80 dark:text-slate-900/70" : "text-slate-500 dark:text-slate-400")}>solo qui</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
  onMostraTutti: () => void;
}

function Elenco({ id, prodotti, griglia, vista, punto, tinta, nomePromo, onMostraTutti }: ElencoProps) {
  const [parametri, aggiorna] = useParametriUrl();
  const cerca = parametri.get("cerca") ?? "";
  const reparto = parametri.get("reparto") || null;
  const soloDiversi = parametri.get("diversi") === "1";
  const ordine = ordineDaIndirizzo(parametri.get("ordina"));
  const [testoRicerca, setTestoRicerca] = useRicercaDifferita(cerca, testo => aggiorna({ cerca: testo }));
  const [aperti, setAperti] = useState<ReadonlySet<string>>(new Set());

  const { reparti, senzaReparto } = useMemo(() => repartiDelConfronto(prodotti), [prodotti]);
  const mostrati = useMemo(
    () => ordinaConfronto(filtraConfronto(prodotti, griglia, { vista, punto: punto?.id ?? null, cerca, reparto, soloDiversi }), ordine),
    [prodotti, griglia, vista, punto, cerca, reparto, soloDiversi, ordine]
  );
  const titolo = titoloVista(vista, griglia);
  const conFiltri = Boolean(cerca || reparto || soloDiversi);
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

  return (
    <div id={id} className="flex scroll-mt-24 flex-col gap-3 border-t border-dashed border-slate-200 pt-4 dark:border-darkmode-400">
      {/* Titolo e strumenti restano in vista scorrendo l'elenco */}
      <div className="sticky top-[9.5rem] z-10 flex flex-col gap-2 bg-white/95 py-2 backdrop-blur dark:bg-darkmode-600/95">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{titolo}</h3>
          <span aria-live="polite" className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
            {plurale(mostrati.length, "prodotto", "prodotti")}
            {punto ? ` stampati da ${punto.nome}` : ""}
          </span>
          {vista && (
            <button
              type="button"
              onClick={onMostraTutti}
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
            {reparti.map(voce => (
              <option key={voce.codice} value={voce.codice}>
                {voce.nome}
              </option>
            ))}
            {senzaReparto && <option value={SENZA_REPARTO}>Senza reparto</option>}
          </FormSelect>
          <FormSelect formSelectSize="sm" aria-label="Ordina per" className="sm:w-52" value={ordine} onChange={evento => aggiorna({ ordina: evento.target.value === "differenza" ? null : evento.target.value })}>
            {ORDINI_CONFRONTO.map(voce => (
              <option key={voce.id} value={voce.id}>
                {voce.etichetta}
              </option>
            ))}
          </FormSelect>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <FormCheck.Input type="checkbox" checked={soloDiversi} onChange={evento => aggiorna({ diversi: evento.target.checked ? "1" : null })} />
            Solo prezzo diverso
          </label>
          <div className="ml-auto flex items-center gap-2">
            {conFiltri && (
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setTestoRicerca("");
                  aggiorna({ cerca: null, reparto: null, diversi: null });
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
        <Legenda />
      </div>

      {mostrati.length === 0 ? (
        <EmptyState compatta icon="SearchX" title="Nessun prodotto" description="Nessun prodotto corrisponde a questa scelta e ai filtri." />
      ) : (
        <div className="overflow-x-auto">
          <table aria-label={titolo} className="w-full min-w-[56rem] border-collapse text-sm">
            <thead>
              <tr className="text-left text-2xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th scope="col" className="border-b border-slate-200 px-3 py-2 font-medium dark:border-darkmode-400">Prodotto</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2 font-medium dark:border-darkmode-400">In quali volantini</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2 font-medium dark:border-darkmode-400">Prezzo</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2 font-medium dark:border-darkmode-400">Differenza</th>
                <th scope="col" className="border-b border-slate-200 px-3 py-2 dark:border-darkmode-400">
                  <span className="sr-only">Prezzi e pagine</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {mostrati.map(prodotto => (
                <RigaProdotto
                  key={prodotto.referenza.chiave}
                  prodotto={prodotto}
                  griglia={griglia}
                  tinta={tinta}
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
      <span className="inline-flex items-center gap-1.5">
        <Pallino stato="caro" /> c'è, a un prezzo più alto del più basso
      </span>
    </div>
  );
}

function Pallino({ stato, titolo }: { stato: "presente" | "assente" | "caro" | "vuota"; titolo?: string }) {
  return (
    <span
      title={titolo}
      aria-hidden="true"
      className={twMerge(
        "inline-block h-3 w-3 flex-none rounded-full",
        stato === "presente" && "bg-theme-1 dark:bg-indigo-300",
        stato === "caro" && "bg-amber-600 dark:bg-amber-400",
        stato === "assente" && "ring-[1.5px] ring-inset ring-slate-300 dark:ring-darkmode-300",
        stato === "vuota" && "bg-transparent"
      )}
    />
  );
}

/** La foto del prodotto; se manca o non si carica, un'icona. */
function Foto({ url }: { url: string | null }) {
  const [rotta, setRotta] = useState(false);
  return (
    <span className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-white dark:border-darkmode-400">
      {url && !rotta ? (
        <img src={url} alt="" loading="lazy" onError={() => setRotta(true)} className="h-full w-full object-contain" />
      ) : (
        <Lucide icon="Image" aria-hidden="true" className="h-5 w-5 text-slate-400" />
      )}
    </span>
  );
}

const CLASSI_CHIP = "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap";

/** I pallini insegne × aree: c'è, non c'è, c'è a un prezzo più alto del più basso. */
function GrigliaPallini({ prodotto, griglia }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini }) {
  const n = griglia.aree.length;
  const perCasella = new Map<number, PresenzaReferenzaPromozione[]>();
  for (const presenza of prodotto.referenza.presenze) {
    const casella = griglia.casellaDelKit.get(presenza.idKit.toLowerCase());
    if (casella !== undefined) perCasella.set(casella, [...(perCasella.get(casella) ?? []), presenza]);
  }
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
            const caro = prodotto.min !== null && presenze.some(p => p.prezzo !== null && p.prezzo > (prodotto.min ?? 0));
            const prezzo = presenze[0]?.prezzo ?? null;
            return <Pallino key={area.id} stato={caro ? "caro" : "presente"} titolo={`${insegna.nome} · ${area.nome}: ${prezzo !== null ? formatEuro(prezzo) : "senza prezzo"}`} />;
          })}
        </Fragment>
      ))}
    </div>
  );
}

function RigaProdotto({
  prodotto,
  griglia,
  tinta,
  aperta,
  onApriChiudi,
}: {
  prodotto: ProdottoConfronto;
  griglia: GrigliaVolantini;
  tinta: (idCanale: string) => Tinta;
  aperta: boolean;
  onApriChiudi: () => void;
}) {
  const idDettaglio = useId();
  const r = prodotto.referenza;
  const dove = descriviPresenze(prodotto, griglia);
  const prezzi = prezziPerLuogo(prodotto, griglia);
  const sottotitolo = [r.formato, r.codice ? `cod. ${r.codice}` : null].filter(Boolean).join(" · ");
  const classeTd = "border-b border-slate-100 px-3 py-3 align-top dark:border-darkmode-400";

  return (
    <>
      <tr className="[&:hover>td]:bg-slate-50 dark:[&:hover>td]:bg-darkmode-400/40">
        <td className={classeTd}>
          <div className="flex gap-3">
            <Foto key={r.foto ?? ""} url={r.foto} />
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
            </div>
          </div>
        </td>
        <td className={classeTd}>
          <p className={twMerge("mb-1.5 font-semibold", dove.eccezione ? "text-cyan-700 dark:text-cyan-300" : "text-slate-700 dark:text-slate-200")}>{dove.testo}</p>
          <GrigliaPallini prodotto={prodotto} griglia={griglia} />
        </td>
        <td className={twMerge(classeTd, "tabular-nums")}>
          {prezzi.length === 0 ? (
            <span className="text-slate-400 dark:text-slate-500">Prezzo non indicato</span>
          ) : prezzi.length === 1 ? (
            <>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{formatEuro(prezzi[0]?.prezzo)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {prodotto.numeroKit === 1 ? "in questo volantino" : `uguale in ${prodotto.numeroKit >= griglia.numeroKit ? "tutti i" : "tutti i suoi"} ${formatNumero(prodotto.numeroKit)} volantini`}
              </p>
            </>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {prezzi.map(voce => (
                <li key={voce.prezzo} className={twMerge("whitespace-nowrap", voce.piuAlto ? "font-semibold text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-slate-100")}>
                  {formatEuro(voce.prezzo)} <span className="font-normal text-slate-500 dark:text-slate-400">{voce.luogo}</span>
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
        <td className={twMerge(classeTd, "text-right")}>
          <button
            type="button"
            aria-expanded={aperta}
            aria-controls={aperta ? idDettaglio : undefined}
            onClick={onApriChiudi}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-control text-xs font-semibold text-theme-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-indigo-200"
          >
            Prezzi e pagine
            <Lucide icon={aperta ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </td>
      </tr>
      {aperta && (
        <tr>
          <td colSpan={5} id={idDettaglio} className="border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-darkmode-400 dark:bg-darkmode-700">
            <PrezziEPagine prodotto={prodotto} griglia={griglia} tinta={tinta} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Prezzo, sconto, barrato e pagina per insegna e area; la pagina apre gli insight del kit su quel prodotto. */
function PrezziEPagine({ prodotto, griglia, tinta }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini; tinta: (idCanale: string) => Tinta }) {
  const r = prodotto.referenza;
  const n = griglia.aree.length;
  const perCasella = new Map<number, PresenzaReferenzaPromozione[]>();
  for (const presenza of r.presenze) {
    const casella = griglia.casellaDelKit.get(presenza.idKit.toLowerCase());
    if (casella !== undefined) perCasella.set(casella, [...(perCasella.get(casella) ?? []), presenza]);
  }
  return (
    <div className="overflow-x-auto">
      <table aria-label={`${r.nome || "Prodotto"}: prezzi e pagine per insegna e area`} className="border-separate border-spacing-1 text-xs tabular-nums">
        <thead>
          <tr>
            <td />
            {griglia.aree.map(area => (
              <th key={area.id} scope="col" className="px-2 text-center font-medium text-slate-600 dark:text-slate-300">
                {area.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {griglia.insegne.map((insegna, a) => (
            <tr key={insegna.id}>
              <th scope="row" className="whitespace-nowrap pr-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                <span className="inline-flex items-center gap-1.5">
                  <LogoInsegna idCanale={insegna.id} nome={insegna.nome} tinta={tinta(insegna.id)} />
                  {insegna.nome}
                </span>
              </th>
              {griglia.aree.map((area, b) => {
                const presenze = perCasella.get(a * n + b) ?? [];
                if (presenze.length === 0) {
                  return (
                    <td key={area.id} className="min-w-[6.5rem] px-2 py-1.5 text-center text-slate-400 dark:text-slate-500">
                      {VUOTO}
                    </td>
                  );
                }
                return (
                  <td key={area.id} className="min-w-[6.5rem] rounded-control bg-white px-2 py-1.5 text-center dark:bg-darkmode-600">
                    {presenze.map(presenza => {
                      const caro = prodotto.min !== null && presenza.prezzo !== null && presenza.prezzo > prodotto.min;
                      return (
                        <div key={presenza.idKit} className="flex flex-col items-center gap-0.5">
                          <span className={twMerge("font-bold", caro ? "text-amber-700 dark:text-amber-300" : "text-slate-800 dark:text-slate-100")} title={presenza.prezzoCalcolato ? NOTA_PREZZO_CALCOLATO : undefined}>
                            {presenza.prezzo !== null ? formatEuro(presenza.prezzo) : VUOTO}
                            {presenza.sconto !== null && <span className="ml-1 font-medium text-slate-600 dark:text-slate-300">−{formatPercentuale(Math.round(presenza.sconto))}</span>}
                          </span>
                          {presenza.barrato !== null && presenza.barrato !== undefined && (
                            <span className="text-slate-500 dark:text-slate-400">
                              <span className="sr-only">invece di </span>
                              <s>{formatEuro(presenza.barrato)}</s>
                            </span>
                          )}
                          <Link
                            to={percorsoDettaglioVolantino(presenza.idKit, presenza.pagina, presenza.idReferenza ?? r.nome)}
                            aria-label={`Apri ${r.nome || "il prodotto"} nel volantino ${insegna.nome} · ${area.nome}${presenza.pagina !== null ? `, pagina ${presenza.pagina}` : ""}`}
                            className="font-semibold text-theme-1 hover:underline dark:text-indigo-200"
                          >
                            {presenza.pagina !== null ? `pagina ${formatNumero(presenza.pagina)}` : "Apri"} →
                          </Link>
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ConfrontoAssortimento;
