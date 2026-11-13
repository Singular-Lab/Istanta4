import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import { Slideover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Segmenti from "@/components/Base/Segmenti";
import type { Tinta } from "@/components/Grafici";
import { ruoliDaIndirizzo, ruoliInIndirizzo, SceltaRuoli } from "@/components/SceltaRuoli";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { formatEuro, formatPercentuale } from "@/pages/PuntiVenditaConsultazione/analisi";
import { formatNumero } from "@/utils/format";
import { twMerge } from "@/utils/twMerge";
import { useId, useMemo, useRef, useState } from "react";
import { unitaPrezzo } from "../../../lib/insightVolantino/unita";
import { useAncoraggio } from "./ancoraggio";
import {
  conteggioRuolo,
  descrizioneRuolo,
  descriviPresenze,
  facceConfronto,
  type GrigliaVolantini,
  LIMITE_IN_COMUNE,
  plurale,
  prezziPerLuogo,
  prodottiInComune,
  type ProdottoConfronto,
  type RuoloDelProdotto,
  ruoliDelProdotto,
  SENZA_FILTRI,
  SENZA_REPARTO,
  SENZA_RUOLO,
} from "./analisi";
import { ID_PRODOTTI_IN_COMUNE } from "./IndicePromozione";
import { SOTTO_LA_BARRA } from "./PannelliAnalisi";
import { Foto, PrezziEPagine } from "./PrezziEPagine";

export interface ProdottiInComuneProps {
  /** Tutti i prodotti del confronto: qui si mostrano quelli in tutti i volantini. */
  prodotti: readonly ProdottoConfronto[];
  griglia: GrigliaVolantini;
  tinta: (idCanale: string) => Tinta;
}

const CLASSI_CHIP = "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium whitespace-nowrap";

/** La differenza fra il prezzo più alto e il più basso, in euro e in %. */
function Differenza({ prodotto }: { prodotto: ProdottoConfronto }) {
  if (prodotto.differenza <= 0) return null;
  return (
    <span className="inline-flex self-start whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
      +{formatEuro(prodotto.differenza)} · +{formatPercentuale(prodotto.percentuale)}
    </span>
  );
}

/** Il prezzo, uguale ovunque, oppure i prezzi raggruppati per luogo dal più basso, con l'unità quando è all'etto. */
function Prezzi({ prodotto, griglia, numeroKit, compatti = false }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini; numeroKit: number; compatti?: boolean }) {
  const prezzi = prezziPerLuogo(prodotto, griglia);
  if (prezzi.length === 0) return <span className="block text-xs text-slate-400 dark:text-slate-500">Prezzo non indicato</span>;
  if (prezzi.length === 1) {
    return (
      <span className="block tabular-nums">
        <span className={twMerge("block font-bold text-slate-800 dark:text-slate-100", compatti ? "text-sm" : "text-base")}>
          {formatEuro(prezzi[0]?.prezzo)}
          {prezzi[0]?.allEtto && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{unitaPrezzo(true)}</span>}
        </span>
        <span className="block text-2xs text-slate-500 dark:text-slate-400">uguale in tutti i {formatNumero(numeroKit)} volantini</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col gap-0.5 text-xs tabular-nums">
      {prezzi.map(voce => (
        <span
          key={voce.prezzo}
          className={twMerge("block truncate", voce.piuAlto ? "font-semibold text-amber-700 dark:text-amber-300" : "font-semibold text-slate-800 dark:text-slate-100")}
          title={`${formatEuro(voce.prezzo)}${unitaPrezzo(voce.allEtto)} ${voce.luogo}`}
        >
          {formatEuro(voce.prezzo)}
          {unitaPrezzo(voce.allEtto)} <span className="font-normal text-slate-500 dark:text-slate-400">{voce.luogo}</span>
        </span>
      ))}
    </span>
  );
}

/** Il ruolo del prodotto e, con più ruoli, in quanti volantini ha ciascuno: "Star in 3 dei 15 volantini in cui compare · Base in 12 …". */
const descrizioneRuoli = (ruoli: readonly RuoloDelProdotto[]): string => ruoli.map(voce => descrizioneRuolo(voce, ruoli.length)).join(" · ");

/** Un'etichetta di ruolo: il nome e, con più ruoli, il conteggio in vista ("Star 3/15"), in elementi separati. */
function Etichetta({ voce, ruoli, classe }: { voce: RuoloDelProdotto; ruoli: number; classe: string }) {
  const conteggio = conteggioRuolo(voce, ruoli);
  return (
    <span aria-hidden="true" className={twMerge("inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold", classe)}>
      <span className="truncate">{voce.ruolo}</span>
      {conteggio && <span className="flex-none font-normal tabular-nums opacity-80">{conteggio}</span>}
    </span>
  );
}

/**
 * Le etichette del ruolo sopra la foto, in alto a sinistra: una per ruolo, dal più frequente, con il
 * conteggio in vista quando sono più d'una ("Star 3/15"). Il suggerimento e il testo per chi non vede
 * dicono la frase intera.
 */
function EtichetteRuolo({ ruoli }: { ruoli: readonly RuoloDelProdotto[] }) {
  if (ruoli.length === 0) return null;
  const descrizione = descrizioneRuoli(ruoli);
  return (
    <span title={`Ruolo: ${descrizione}`} className="pointer-events-none absolute left-1.5 top-1.5 flex max-w-[calc(100%-0.75rem)] flex-wrap gap-1">
      <span className="sr-only">Ruolo: {descrizione}.</span>
      {ruoli.map(voce => (
        <Etichetta key={voce.ruolo} voce={voce} ruoli={ruoli.length} classe="bg-slate-900/85 text-white shadow-sm dark:bg-slate-100/90 dark:text-slate-900" />
      ))}
    </span>
  );
}

/** Una scheda: foto con il ruolo, nome con la marca in evidenza, formato, reparto, prezzi e differenza; apre prezzi e pagine. */
function Scheda({ prodotto, griglia, onApri }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini; onApri: () => void }) {
  const r = prodotto.referenza;
  const reparto = r.reparto ? r.reparto.descrizione || r.reparto.codice : "Senza reparto";
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onApri}
      className="flex h-full w-full flex-col gap-2 rounded-card border border-slate-200 bg-white p-3 text-left transition-colors hover:border-theme-1/50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:border-darkmode-400 dark:bg-darkmode-600 dark:hover:border-indigo-300/60"
    >
      <span className="relative block">
        <Foto key={r.foto ?? ""} url={r.foto} className="aspect-[4/3] h-auto w-full" />
        <EtichetteRuolo ruoli={ruoliDelProdotto(r)} />
      </span>
      <span className="block text-sm font-medium leading-snug text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
        {r.nome || "Prodotto senza nome"}
        {r.marca && (
          <>
            {" "}
            <strong className="font-extrabold">{r.marca}</strong>
          </>
        )}
      </span>
      {r.formato && <span className="block text-xs text-slate-500 dark:text-slate-400">{r.formato}</span>}
      <span className="flex flex-wrap gap-1">
        {/* Un reparto dal nome lungo non esce dalla scheda: si accorcia, il nome intero resta nel suggerimento */}
        <span title={reparto} className={twMerge(CLASSI_CHIP, "block max-w-full truncate bg-slate-100 text-slate-700 dark:bg-darkmode-400 dark:text-slate-200")}>
          {reparto}
        </span>
        {r.sottocosto && <span className={twMerge(CLASSI_CHIP, "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-300")}>Sottocosto</span>}
      </span>
      <span className="mt-auto flex flex-col gap-1.5 pt-1">
        <Prezzi prodotto={prodotto} griglia={griglia} numeroKit={griglia.numeroKit} />
        <Differenza prodotto={prodotto} />
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-theme-1 dark:text-indigo-200">
          Prezzi e pagine
          <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      </span>
    </button>
  );
}

/** Una riga dell'elenco compatto: foto piccola, nome con la marca, ruoli, reparto, prezzi e differenza; apre prezzi e pagine. */
function RigaCompatta({ prodotto, griglia, onApri }: { prodotto: ProdottoConfronto; griglia: GrigliaVolantini; onApri: () => void }) {
  const r = prodotto.referenza;
  const ruoli = ruoliDelProdotto(r);
  const reparto = r.reparto ? r.reparto.descrizione || r.reparto.codice : "Senza reparto";
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onApri}
      className="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-control px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 sm:grid-cols-[2.5rem_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_auto] dark:hover:bg-darkmode-500"
    >
      <Foto key={r.foto ?? ""} url={r.foto} className="h-10 w-10" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
          {r.nome || "Prodotto senza nome"}
          {r.marca && (
            <>
              {" "}
              <strong className="font-extrabold">{r.marca}</strong>
            </>
          )}
        </span>
        {r.formato && <span className="block text-xs text-slate-500 dark:text-slate-400">{r.formato}</span>}
      </span>
      <span className="col-start-2 flex min-w-0 flex-wrap items-center gap-1 sm:col-start-auto">
        {ruoli.length > 0 && <span className="sr-only">Ruolo: {descrizioneRuoli(ruoli)}.</span>}
        {ruoli.map(voce => (
          <Etichetta key={voce.ruolo} voce={voce} ruoli={ruoli.length} classe="bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900" />
        ))}
        <span title={reparto} className={twMerge(CLASSI_CHIP, "block max-w-full truncate bg-slate-100 text-slate-700 dark:bg-darkmode-400 dark:text-slate-200")}>
          {reparto}
        </span>
      </span>
      <span className="col-start-2 min-w-0 sm:col-start-auto">
        <Prezzi prodotto={prodotto} griglia={griglia} numeroKit={griglia.numeroKit} compatti />
      </span>
      <span className="col-start-2 sm:col-start-auto">
        <Differenza prodotto={prodotto} />
      </span>
    </button>
  );
}

/** Come si vedono i prodotti in comune: schede con la foto grande, o un elenco compatto. */
type VistaComuni = "schede" | "elenco";

const OPZIONI_VISTA: Array<{ valore: VistaComuni; etichetta: string }> = [
  { valore: "schede", etichetta: "Schede" },
  { valore: "elenco", etichetta: "Elenco" },
];

/**
 * I prodotti in comune (spec volantini-pop), in primo piano subito dopo i numeri del confronto: una
 * scheda per ogni prodotto stampato in tutti i volantini mostrati, con il ruolo sopra la foto, prima
 * quelli con prezzi diversi. Filtri propri per testo, reparto e ruoli (a scelta multipla, con i
 * conteggi), con le voci che seguono gli altri filtri, nell'indirizzo
 * (?cercaComuni=&repartoComuni=&ruoloComuni=), che non toccano l'elenco di tutti i prodotti; come schede
 * o come elenco compatto (?vistaComuni=elenco). Oltre LIMITE_IN_COMUNE prodotti gli altri si aprono a
 * richiesta, e richiudendoli il comando resta dov'era; un prodotto apre in un pannello prezzo, sconto,
 * barrato e pagina per insegna e area, con gli insight del kit su quel prodotto.
 */
export function ProdottiInComune({ prodotti, griglia, tinta }: ProdottiInComuneProps) {
  const [parametri, aggiorna] = useParametriUrl();
  const cerca = parametri.get("cercaComuni") ?? "";
  const reparto = parametri.get("repartoComuni") || null;
  const testoRuoli = parametri.get("ruoloComuni");
  const ruoli = useMemo(() => ruoliDaIndirizzo(testoRuoli), [testoRuoli]);
  const vista: VistaComuni = parametri.get("vistaComuni") === "elenco" ? "elenco" : "schede";
  const [testoRicerca, setTestoRicerca] = useRicercaDifferita(cerca, testo => aggiorna({ cercaComuni: testo }));
  const comuni = useMemo(() => prodottiInComune(prodotti, griglia), [prodotti, griglia]);
  const filtrati = useMemo(() => prodottiInComune(prodotti, griglia, { cerca, reparto, ruoli }), [prodotti, griglia, cerca, reparto, ruoli]);
  // I filtri propongono solo i reparti e i ruoli dei prodotti in comune che rispondono agli altri filtri
  const facce = useMemo(
    () => facceConfronto(prodotti, griglia, { ...SENZA_FILTRI, vista: { tipo: "base" }, cerca, reparto, ruoli }),
    [prodotti, griglia, cerca, reparto, ruoli]
  );
  const conRuoli = useMemo(() => comuni.some(p => (p.referenza.ruoli ?? []).length > 0), [comuni]);
  const [tutti, setTutti] = useState(false);
  const [chiaveAperta, setChiaveAperta] = useState<string | null>(null);
  const idTitolo = useId();
  const ancora = useAncoraggio();
  const comandoTutti = useRef<HTMLButtonElement>(null);

  const conFiltri = Boolean(cerca || reparto || ruoli.length > 0);
  const azzera = () => {
    setTestoRicerca("");
    aggiorna({ cercaComuni: null, repartoComuni: null, ruoloComuni: null });
  };
  const diversi = comuni.filter(p => p.differenza > 0).length;
  const mostrati = tutti ? filtrati : filtrati.slice(0, LIMITE_IN_COMUNE);
  const vociRuoli = [
    ...facce.ruoli.map(voce => ({ valore: voce.ruolo, etichetta: voce.ruolo, conteggio: voce.prodotti })),
    ...(facce.senzaRuolo > 0 ? [{ valore: SENZA_RUOLO, etichetta: "Senza ruolo", conteggio: facce.senzaRuolo }] : []),
  ];
  // Cambiando i volantini mostrati il prodotto aperto può non essere più in comune: il pannello si chiude
  const aperto = comuni.find(p => p.referenza.chiave === chiaveAperta) ?? null;
  const numeroKit = formatNumero(griglia.numeroKit);

  return (
    <section id={ID_PRODOTTI_IN_COMUNE} aria-labelledby={idTitolo} className={twMerge("flex flex-col gap-3", SOTTO_LA_BARRA)}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 id={idTitolo} className="title-card dark:text-slate-200">
          Prodotti in comune
        </h3>
        {comuni.length > 0 && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {plurale(comuni.length, "prodotto", "prodotti")} in tutti i {numeroKit} volantini
            {diversi > 0 ? ` · ${formatNumero(diversi)} con prezzo diverso, qui per primi` : " · stesso prezzo ovunque"}. Apri un prodotto per prezzi, sconti e pagine.
          </p>
        )}
        {comuni.length > 0 && (
          <Segmenti<VistaComuni>
            etichetta="Vedi i prodotti in comune come"
            opzioni={OPZIONI_VISTA}
            valore={vista}
            onChange={scelta => aggiorna({ vistaComuni: scelta === "elenco" ? "elenco" : null })}
            className="ml-auto"
          />
        )}
      </div>

      {comuni.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <CampoRicerca
            etichetta="Cerca fra i prodotti in comune"
            placeholder="Prodotto, marca, codice…"
            value={testoRicerca}
            onChange={setTestoRicerca}
            className="sm:w-64"
          />
          <FormSelect formSelectSize="sm" aria-label="Reparto dei prodotti in comune" className="sm:w-52" value={reparto ?? ""} onChange={evento => aggiorna({ repartoComuni: evento.target.value })}>
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
          {conFiltri && (
            <>
              <span aria-live="polite" className="text-sm tabular-nums text-slate-500 dark:text-slate-400">
                {formatNumero(filtrati.length)} di {plurale(comuni.length, "prodotto in comune", "prodotti in comune")}
              </span>
              <Button type="button" variant="outline-secondary" size="sm" onClick={azzera} className="ml-auto">
                <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Azzera filtri
              </Button>
            </>
          )}
          {(conRuoli || ruoli.length > 0) && (
            <SceltaRuoli
              etichetta="Ruolo dei prodotti in comune"
              voci={vociRuoli}
              scelti={ruoli}
              unita={["prodotto", "prodotti"]}
              onCambia={scelti => aggiorna({ ruoloComuni: ruoliInIndirizzo(scelti) })}
              className="basis-full"
            />
          )}
        </div>
      )}

      {comuni.length === 0 ? (
        <p className="rounded-card border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-darkmode-300 dark:text-slate-300">
          Nessun prodotto è in tutti i {numeroKit} volantini mostrati. Per vedere quelli in comune a un gruppo di volantini filtra la pagina per insegna o per area.
        </p>
      ) : filtrati.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-darkmode-300 dark:text-slate-300">
          <span>Nessun prodotto in comune corrisponde ai filtri.</span>
          <Button type="button" variant="outline-secondary" size="sm" onClick={azzera}>
            Azzera filtri
          </Button>
        </div>
      ) : vista === "elenco" ? (
        <ul aria-label="Prodotti in comune" data-vista="elenco" className="flex flex-col divide-y divide-slate-100 rounded-card border border-slate-200 bg-white px-1 dark:divide-darkmode-400 dark:border-darkmode-400 dark:bg-darkmode-600">
          {mostrati.map(prodotto => (
            <li key={prodotto.referenza.chiave}>
              <RigaCompatta prodotto={prodotto} griglia={griglia} onApri={() => setChiaveAperta(prodotto.referenza.chiave)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul aria-label="Prodotti in comune" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {mostrati.map(prodotto => (
            <li key={prodotto.referenza.chiave}>
              <Scheda prodotto={prodotto} griglia={griglia} onApri={() => setChiaveAperta(prodotto.referenza.chiave)} />
            </li>
          ))}
        </ul>
      )}

      {filtrati.length > LIMITE_IN_COMUNE && (
        <button
          ref={comandoTutti}
          type="button"
          aria-expanded={tutti}
          onClick={() => {
            // Richiudendo, l'elenco si accorcia sopra il comando: il comando resta dov'era
            ancora(comandoTutti.current, document.getElementById(ID_PRODOTTI_IN_COMUNE));
            setTutti(attuale => !attuale);
          }}
          className="inline-flex items-center gap-1 self-center rounded-control px-3 py-1.5 text-sm font-semibold text-theme-1 hover:bg-theme-1/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:text-indigo-200 dark:hover:bg-indigo-300/15"
        >
          {tutti ? "Mostra meno" : `Mostra tutti i ${formatNumero(filtrati.length)} prodotti in comune`}
          <Lucide icon={tutti ? "ChevronUp" : "ChevronDown"} aria-hidden="true" className="h-4 w-4" />
        </button>
      )}

      <Slideover open={aperto !== null} onClose={() => setChiaveAperta(null)} size="xl">
        <Slideover.Panel>
          {aperto && (
            <>
              {/* Il titolo dà il nome al pannello; Chiudi gli sta accanto, fuori dal nome */}
              <div className="flex items-center gap-2 border-b border-slate-200/60 pr-4 dark:border-darkmode-400">
                <Slideover.Title className="min-w-0 flex-1 gap-3 border-b-0 py-4">
                  <Foto key={aperto.referenza.foto ?? ""} url={aperto.referenza.foto} className="h-12 w-12" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-slate-800 [overflow-wrap:anywhere] dark:text-slate-100">
                      {aperto.referenza.nome || "Prodotto senza nome"}
                      {aperto.referenza.marca && (
                        <>
                          {" "}
                          <strong className="font-extrabold">{aperto.referenza.marca}</strong>
                        </>
                      )}
                    </span>
                    <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                      {[aperto.referenza.formato, aperto.referenza.codice ? `cod. ${aperto.referenza.codice}` : null].filter(Boolean).join(" · ") || descriviPresenze(aperto, griglia).testo}
                    </span>
                  </span>
                </Slideover.Title>
                <button
                  type="button"
                  aria-label="Chiudi"
                  onClick={() => setChiaveAperta(null)}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 dark:hover:bg-darkmode-400"
                >
                  <Lucide icon="X" aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{descriviPresenze(aperto, griglia).testo}</p>
                  {ruoliDelProdotto(aperto.referenza).length > 0 && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">Ruolo: {descrizioneRuoli(ruoliDelProdotto(aperto.referenza))}</p>
                  )}
                  <Prezzi prodotto={aperto} griglia={griglia} numeroKit={griglia.numeroKit} />
                  <Differenza prodotto={aperto} />
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Prezzi e pagine per insegna e area</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Scegli una pagina per aprire gli insight di quel volantino su questo prodotto.</p>
                  <PrezziEPagine prodotto={aperto} griglia={griglia} tinta={tinta} />
                </div>
              </div>
            </>
          )}
        </Slideover.Panel>
      </Slideover>
    </section>
  );
}
