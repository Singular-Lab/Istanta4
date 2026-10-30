import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormCheck, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { useSchermoStretto } from "@/components/PuntiVendita/useSchermoStretto";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { descriviStato } from "@/constants/stati";
import { useParametriUrl } from "@/hooks/useParametriUrl";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { useFetchFilePop, useFetchOpzioniFilePop } from "@/query/query";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { articoloPlurale, urlAnteprimaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useId, useRef, useState } from "react";
import type { STATO_LOG_FILE } from "../../../lib/enums";
import type { PeriodoMateriali } from "../../../lib/materiali/periodi";
import { DIMENSIONI_PAGINA_POP, STATI_FILE_POP, type FilePop, type FormatoPop, type PromoMateriali } from "../../../lib/materiali/tipi";
import { filtriPerZip, MOTIVO_SENZA_DOWNLOAD, urlFileSingolo, useScaricaZipPop } from "./scaricamenti";

/**
 * Filtri dei file nell'indirizzo, accanto a promo e formato: restano ricaricando la pagina e
 * tornando indietro; scegliendo un'altra promo o un altro formato si perdono. Vuoti = tolti.
 */
const SENZA_FILTRI = { cerca: "", stato: "", area: "", canale: "", reparto: "" } as const;
type ParametroFiltro = keyof typeof SENZA_FILTRI;

const OPZIONI_DIMENSIONE = [...DIMENSIONI_PAGINA_POP];
const DIMENSIONE_PREDEFINITA = OPZIONI_DIMENSIONE[0];

// Filtri: da sm una riga sola, con la ricerca che prende lo spazio libero e le tendine strette
// (le scritte "Tutti gli stati", "Tutte le aree"… stanno in 7rem); sotto sm la ricerca e due
// tendine per riga
const CLASSI_RICERCA = "sm:w-auto sm:min-w-0 sm:flex-[1_1_9rem]";
const CLASSI_TENDINA = "sm:min-w-0 sm:max-w-[8.5rem] sm:flex-[1_1_6.75rem]";

const isStatoFile = (valore: string): valore is STATO_LOG_FILE => (STATI_FILE_POP as readonly string[]).includes(valore);

/** Casella "seleziona la pagina": anche indeterminata, quando solo una parte della pagina è scelta. */
function CasellaPagina({
  selezionata,
  parziale,
  disabled,
  onChange,
}: {
  selezionata: boolean;
  parziale: boolean;
  disabled?: boolean;
  onChange: (selezionata: boolean) => void;
}) {
  // FormCheck.Input non inoltra il ref: lo stato indeterminato si imposta sull'input contenuto
  const contenitore = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const casella = contenitore.current?.querySelector("input");
    if (casella) casella.indeterminate = parziale;
  }, [parziale]);
  return (
    <span ref={contenitore} className="inline-flex">
      <FormCheck.Input
        type="checkbox"
        aria-label="Seleziona la pagina"
        checked={selezionata}
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.checked)}
      />
    </span>
  );
}

/** Scheletro dei file, fuori dalla tabella: su mobile una tabella che scorre lo taglierebbe. */
function FileInCaricamento() {
  return (
    <div role="status" aria-label="Caricamento dei file" className="flex flex-col gap-3 p-5">
      {Array.from({ length: 6 }, (_, indice) => (
        <Skeleton key={indice} className="h-9" />
      ))}
    </div>
  );
}

interface FileFormatoProps {
  promo: PromoMateriali;
  periodo: PeriodoMateriali;
  formato: FormatoPop;
  puoScaricare: boolean;
  /** Cresce a ogni scelta di un formato (0 = nessuna): la sezione viene in vista e prende il focus. */
  richiesteInVista: number;
}

/**
 * File di un formato POP, caricati a pagine dal server: filtri, selezione per lo ZIP (i file
 * scelti, oppure tutti quelli che corrispondono ai filtri), anteprima e download del singolo file.
 */
function FileFormato({ promo, periodo, formato, puoScaricare, richiesteInVista }: FileFormatoProps) {
  const idSezione = useId();
  const tabella = useRef<HTMLDivElement>(null);
  const [parametri, aggiorna] = useParametriUrl();
  const [selezionati, setSelezionati] = useState<ReadonlySet<string>>(new Set());
  // Tutti i file che corrispondono ai filtri, anche quelli delle altre pagine
  const [tuttiSelezionati, setTuttiSelezionati] = useState(false);
  const [anteprima, setAnteprima] = useState<FilePop | null>(null);
  const { inPreparazione, scarica } = useScaricaZipPop(promo.id);
  // Sotto sm i file sono schede: la tabella a sette colonne taglierebbe stato e comandi
  const stretto = useSchermoStretto();

  const cerca = parametri.get("cerca") ?? "";
  const statoLetto = parametri.get("stato") ?? "";
  // Uno stato che i file POP non hanno (indirizzo vecchio o scritto a mano) non filtra
  const stato = isStatoFile(statoLetto) ? statoLetto : "";
  const idArea = parametri.get("area") ?? "";
  const idCanale = parametri.get("canale") ?? "";
  const reparto = parametri.get("reparto") ?? "";
  const pagina = Math.max(1, Math.trunc(Number(parametri.get("pagina"))) || 1);
  const dimensioneLetta = Number(parametri.get("dimensione"));
  const dimensione = OPZIONI_DIMENSIONE.includes(dimensioneLetta) ? dimensioneLetta : DIMENSIONE_PREDEFINITA;

  // Promo e formato restano nell'indirizzo accanto ai filtri: ricaricando si riapre lo stesso formato
  const formatoAperto = { promo: promo.id, formato: formato.id };

  const annullaSelezione = () => {
    setSelezionati(new Set());
    setTuttiSelezionati(false);
  };

  // Con filtri nuovi la selezione non varrebbe più per i file mostrati: si riparte da zero
  const filtra = (modifiche: Partial<Record<ParametroFiltro, string>>) => {
    aggiorna({ ...formatoAperto, ...modifiche, pagina: null });
    annullaSelezione();
  };
  const [testoRicerca, setTestoRicerca] = useRicercaDifferita(cerca, (testo) => filtra({ cerca: testo }));

  const azzeraFiltri = () => {
    setTestoRicerca("");
    filtra(SENZA_FILTRI);
  };

  const cambiaPagina = (nuova: number) => {
    aggiorna({ ...formatoAperto, pagina: nuova === 1 ? null : nuova });
    // La pagina nuova si legge dall'inizio, non da dove si era arrivati con quella prima
    tabella.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  };

  const filtriAttivi = {
    cerca: cerca || undefined,
    stato: stato || undefined,
    idArea: idArea || undefined,
    idCanale: idCanale || undefined,
    reparto: reparto || undefined,
  };
  const conFiltri = Object.values(filtriAttivi).some(Boolean);

  const query = useFetchFilePop(promo.id, { periodo, idFormato: formato.id, ...filtriAttivi, pagina, dimensione });
  // Le tendine si chiedono una volta per formato, non a ogni pagina o filtro
  const opzioni = useFetchOpzioniFilePop(promo.id, periodo, formato.id).data;
  const dati = query.data;
  const file = dati?.file ?? [];
  const totale = dati?.totale ?? 0;
  // Finché arrivano i file nuovi restano visibili quelli di prima: non si possono scegliere
  const inAggiornamento = query.isPlaceholderData;

  // Una pagina oltre l'ultima (indirizzo vecchio, file spariti nel frattempo) torna alla prima
  useEffect(() => {
    if (dati && !query.isPlaceholderData && dati.file.length === 0 && dati.totale > 0 && pagina > 1) aggiorna({ pagina: null });
  }, [dati, query.isPlaceholderData, pagina, aggiorna]);

  // Scelto un formato, i suoi file vengono in vista: anche sotto la tabella dei formati, su mobile
  useEffect(() => {
    if (richiesteInVista === 0) return;
    const sezione = document.getElementById(idSezione);
    sezione?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    sezione?.focus({ preventScroll: true });
  }, [richiesteInVista, idSezione]);

  const paginaSelezionata = file.length > 0 && file.every((voce) => selezionati.has(voce.id));
  const paginaParziale = !paginaSelezionata && file.some((voce) => selezionati.has(voce.id));

  const selezionaPagina = (selezionata: boolean) =>
    setSelezionati((attuali) => {
      const prossimi = new Set(attuali);
      for (const voce of file) {
        if (selezionata) prossimi.add(voce.id);
        else prossimi.delete(voce.id);
      }
      return prossimi;
    });

  const selezionaFile = (id: string, selezionato: boolean) =>
    setSelezionati((attuali) => {
      const prossimi = new Set(attuali);
      if (selezionato) prossimi.add(id);
      else prossimi.delete(id);
      return prossimi;
    });

  // Lo ZIP dei file scelti o di tutti quelli trovati: prima la verifica, poi il download in streaming
  const scaricaSelezionati = () => {
    if (!puoScaricare || selezionati.size === 0) return;
    void scarica("selezionati", { periodo, idFormato: formato.id, idFile: [...selezionati] });
  };
  const scaricaTuttiTrovati = () => {
    if (!puoScaricare) return;
    void scarica("tutti", { periodo, idFormato: formato.id, filtri: filtriPerZip(filtriAttivi) });
  };

  const nomeDi = (elenco: { id: string; nome: string }[] | undefined, id: string) =>
    elenco?.find((voce) => voce.id === id)?.nome ?? id;

  // Riepilogo dei filtri nello stato vuoto: Ricerca «…» · Stato «…» · Area «…»
  const riepilogoFiltri = [
    cerca && `Ricerca «${cerca}»`,
    stato && `Stato «${descriviStato("fileKit", stato).etichetta}»`,
    idArea && `Area «${nomeDi(opzioni?.aree, idArea)}»`,
    idCanale && `Canale «${nomeDi(opzioni?.canali, idCanale)}»`,
    reparto && `Reparto «${reparto}»`,
  ]
    .filter(Boolean)
    .join(" · ");

  const comandoSenzaPermesso = (etichetta: string, icona: string) => (
    <Button type="button" size="sm" variant="outline-secondary" disabled title={MOTIVO_SENZA_DOWNLOAD}>
      <Lucide icon={icona} aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
      {etichetta}
    </Button>
  );

  const barraSelezione = (selezionati.size > 0 || tuttiSelezionati) && (
    <div
      role="status"
      className="flex flex-col gap-3 border-b border-dashed border-slate-200 bg-theme-1/5 px-5 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center"
    >
      <span className="text-slate-700">
        {tuttiSelezionati ? (
          <>
            Selezionati tutti {articoloPlurale(totale)} <strong className="tabular-nums">{formatNumero(totale)}</strong> file
            {conFiltri ? " che corrispondono ai filtri" : " del formato"}
          </>
        ) : (
          <>
            <strong className="tabular-nums">{formatNumero(selezionati.size)}</strong>{" "}
            {selezionati.size === 1 ? "file selezionato" : "file selezionati"}
          </>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {tuttiSelezionati ? (
          puoScaricare ? (
            <Button type="button" size="sm" variant="primary" onClick={scaricaTuttiTrovati} loading={inPreparazione === "tutti"}>
              {inPreparazione !== "tutti" && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
              Scarica ZIP
            </Button>
          ) : (
            comandoSenzaPermesso("Scarica ZIP", "Download")
          )
        ) : puoScaricare ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={scaricaSelezionati}
            loading={inPreparazione === "selezionati"}
          >
            {inPreparazione !== "selezionati" && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
            Scarica selezionati
          </Button>
        ) : (
          comandoSenzaPermesso("Scarica selezionati", "Download")
        )}
        {!tuttiSelezionati && totale > file.length && (
          <Button
            type="button"
            size="sm"
            variant="outline-secondary"
            disabled={inAggiornamento}
            onClick={() => setTuttiSelezionati(true)}
          >
            {conFiltri
              ? `Seleziona tutti ${articoloPlurale(totale)} ${formatNumero(totale)} file trovati`
              : `Seleziona tutti ${articoloPlurale(totale)} ${formatNumero(totale)} del formato`}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline-secondary" onClick={annullaSelezione}>
          Annulla selezione
        </Button>
      </div>
      {!puoScaricare && <span className="text-xs text-slate-500">{MOTIVO_SENZA_DOWNLOAD}</span>}
    </div>
  );

  // Errore, caricamento e nessun file stanno fuori dalla tabella: dentro una tabella che scorre in
  // orizzontale (su mobile) sarebbero tagliati a metà
  const statoFile = (() => {
    if (query.isError) {
      return (
        <div className="p-5">
          <PageError
            compatta
            titolo="File non caricati"
            motivo={query.error?.message || "Il servizio non ha restituito i file del formato."}
            onRiprova={() => query.refetch()}
          />
        </div>
      );
    }
    if (!dati) return <FileInCaricamento />;
    if (dati.totale === 0) {
      return conFiltri ? (
        <EmptyState
          compatta
          icon="SearchX"
          title="Nessun file corrisponde ai filtri"
          description={riepilogoFiltri}
          buttonText="Azzera filtri"
          buttonIcon="X"
          onButtonClick={azzeraFiltri}
        />
      ) : (
        <EmptyState
          compatta
          icon="FileX"
          title="Nessun file in questo formato"
          description="I file compaiono qui quando i kit del formato li producono."
        />
      );
    }
    return null;
  })();

  // I pezzi di un file, uguali nella riga della tabella e nella scheda
  const casellaFile = (voce: FilePop) => (
    <FormCheck.Input
      type="checkbox"
      aria-label={`Seleziona ${voce.nome}`}
      checked={tuttiSelezionati || selezionati.has(voce.id)}
      disabled={tuttiSelezionati || inAggiornamento}
      onChange={(evento) => selezionaFile(voce.id, evento.target.checked)}
    />
  );
  const versioneFile = (voce: FilePop) =>
    voce.versione !== null && voce.versione !== undefined ? `v${voce.versione}` : VALORE_ASSENTE;
  const comandiFile = (voce: FilePop) => (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline-secondary"
        aria-label={`Anteprima ${voce.nome}`}
        title="Anteprima"
        disabled={!voce.idOlimpoCloud}
        onClick={() => setAnteprima(voce)}
      >
        <Lucide icon="Eye" aria-hidden="true" className="h-3.5 w-3.5" />
      </Button>
      {puoScaricare && voce.idOlimpoCloud ? (
        <Button
          as="a"
          href={urlFileSingolo(voce.idOlimpoCloud, voce.nome)}
          download={voce.nome}
          size="sm"
          variant="outline-secondary"
          aria-label={`Scarica ${voce.nome}`}
          title="Scarica"
        >
          <Lucide icon="Download" aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline-secondary"
          aria-label={`Scarica ${voce.nome}`}
          title={puoScaricare ? "File non disponibile" : MOTIVO_SENZA_DOWNLOAD}
          disabled
        >
          <Lucide icon="Download" aria-hidden="true" className="h-3.5 w-3.5" />
        </Button>
      )}
    </>
  );

  const casellaPagina = (
    <CasellaPagina
      selezionata={tuttiSelezionati || paginaSelezionata}
      parziale={!tuttiSelezionati && paginaParziale}
      disabled={tuttiSelezionati || file.length === 0 || inAggiornamento}
      onChange={selezionaPagina}
    />
  );

  const schedeFile = (
    <>
      <div className="flex items-center gap-3 border-b border-dashed border-slate-200 px-5 py-2.5 text-xs text-slate-500 dark:border-darkmode-400 dark:text-slate-400">
        {casellaPagina}
        <span aria-hidden="true">Tutta la pagina</span>
      </div>
      <ul aria-label="File del formato" className="divide-y divide-slate-100 dark:divide-darkmode-400">
        {file.map((voce) => (
          <li key={voce.id} className="flex gap-3 px-5 py-3.5">
            <div className="pt-0.5">{casellaFile(voce)}</div>
            <div className="min-w-0 flex-1">
              <div className="break-all text-sm font-medium text-slate-700 dark:text-slate-200">{voce.nome}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {voce.area.nome} · {voce.canale.nome}
              </div>
              {(voce.referenza?.descrizione || voce.referenza?.codice) && (
                <div className="mt-1.5 text-sm text-slate-700 [overflow-wrap:anywhere] dark:text-slate-200">
                  {voce.referenza?.descrizione || VALORE_ASSENTE}
                  {voce.referenza?.codice && <span className="ml-1.5 text-xs tabular-nums text-slate-500">{voce.referenza.codice}</span>}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                {voce.stato && <StatusBadge dominio="fileKit" stato={voce.stato} />}
                {voce.reparto && <span>{voce.reparto}</span>}
                <span className="tabular-nums">{versioneFile(voce)}</span>
              </div>
            </div>
            <div className="flex flex-none flex-col gap-1.5">{comandiFile(voce)}</div>
          </li>
        ))}
      </ul>
    </>
  );

  const tabellaFile = (
    <div className="overflow-x-auto">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th className="w-10">{casellaPagina}</Table.Th>
            <Table.Th>File</Table.Th>
            <Table.Th>Referenza</Table.Th>
            <Table.Th>Reparto</Table.Th>
            <Table.Th>Stato</Table.Th>
            <Table.Th>Ver.</Table.Th>
            <Table.Th className="text-right">
              <span className="sr-only">Azioni</span>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {file.map((voce) => (
            <Table.Tr key={voce.id}>
              <Table.Td className="w-10">{casellaFile(voce)}</Table.Td>
              <Table.Td className="min-w-48">
                <div className="break-all font-medium text-slate-700 dark:text-slate-200">{voce.nome}</div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {voce.area.nome} · {voce.canale.nome}
                </div>
              </Table.Td>
              <Table.Td className="min-w-48">
                <div className="text-slate-700 dark:text-slate-200">{voce.referenza?.descrizione || VALORE_ASSENTE}</div>
                {voce.referenza?.codice && <div className="mt-0.5 text-xs tabular-nums text-slate-500">{voce.referenza.codice}</div>}
              </Table.Td>
              <Table.Td className="whitespace-nowrap">
                {voce.reparto ? (
                  <span className="text-slate-700 dark:text-slate-200">{voce.reparto}</span>
                ) : (
                  <span className="text-slate-400">{VALORE_ASSENTE}</span>
                )}
              </Table.Td>
              <Table.Td>
                {voce.stato ? (
                  <StatusBadge dominio="fileKit" stato={voce.stato} />
                ) : (
                  <span className="text-slate-400">{VALORE_ASSENTE}</span>
                )}
              </Table.Td>
              <Table.Td className="tabular-nums text-slate-600 dark:text-slate-300">{versioneFile(voce)}</Table.Td>
              <Table.Td className="text-right">
                <div className="flex justify-end gap-1.5">{comandiFile(voce)}</div>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );

  return (
    <Sezione
      id={idSezione}
      tabIndex={-1}
      senzaPadding
      titolo={`File del formato ${formato.nome} · ${formatNumero(formato.numeroFile)} file`}
      descrizione="I file si caricano una pagina alla volta; i filtri valgono anche per lo ZIP di tutti i file trovati."
      className="scroll-mt-24 focus:outline-none"
    >
      {/* Da sm una riga: la barra dei filtri si allarga quanto la sezione, la ricerca prende lo spazio libero */}
      <BarraFiltri
        className="[&>div:first-child]:flex-1"
        destra={
          conFiltri ? (
            <Button type="button" variant="outline-secondary" size="sm" onClick={azzeraFiltri}>
              <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Azzera filtri
            </Button>
          ) : undefined
        }
      >
        <CampoRicerca
          etichetta="Cerca"
          placeholder="Cerca file…"
          title="Nome del file, codice o descrizione della referenza"
          value={testoRicerca}
          onChange={setTestoRicerca}
          className={CLASSI_RICERCA}
        />
        {/* Sotto sm due tendine per riga; da sm "contents" le rimette nella riga dei filtri */}
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <FormSelect
            formSelectSize="sm"
            aria-label="Stato file"
            className={CLASSI_TENDINA}
            value={stato}
            onChange={(evento) => filtra({ stato: isStatoFile(evento.target.value) ? evento.target.value : "" })}
          >
            <option value="">Tutti gli stati</option>
            {STATI_FILE_POP.map((voce) => (
              <option key={voce} value={voce}>
                {descriviStato("fileKit", voce).etichetta}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            formSelectSize="sm"
            aria-label="Area"
            className={CLASSI_TENDINA}
            value={idArea}
            onChange={(evento) => filtra({ area: evento.target.value })}
          >
            <option value="">Tutte le aree</option>
            {opzioni?.aree.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nome}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            formSelectSize="sm"
            aria-label="Canale"
            className={CLASSI_TENDINA}
            value={idCanale}
            onChange={(evento) => filtra({ canale: evento.target.value })}
          >
            <option value="">Tutti i canali</option>
            {opzioni?.canali.map((canale) => (
              <option key={canale.id} value={canale.id}>
                {canale.nome}
              </option>
            ))}
          </FormSelect>
          <FormSelect
            formSelectSize="sm"
            aria-label="Reparto"
            className={CLASSI_TENDINA}
            value={reparto}
            onChange={(evento) => filtra({ reparto: evento.target.value })}
          >
            <option value="">Tutti i reparti</option>
            {opzioni?.reparti.map((voce) => (
              <option key={voce} value={voce}>
                {voce}
              </option>
            ))}
          </FormSelect>
        </div>
      </BarraFiltri>

      {barraSelezione}

      <div
        ref={tabella}
        className={twMerge("scroll-mt-24 transition-opacity", inAggiornamento && "opacity-60")}
        aria-busy={!dati || inAggiornamento || undefined}
      >
        {statoFile ?? (stretto ? schedeFile : tabellaFile)}
      </div>

      {dati && !query.isError && (
        <PaginazioneTabella
          totale={totale}
          pagina={pagina}
          dimensionePagina={dimensione}
          onCambiaPagina={cambiaPagina}
          onCambiaDimensione={(nuova) =>
            aggiorna({ ...formatoAperto, dimensione: nuova === DIMENSIONE_PREDEFINITA ? null : nuova, pagina: null })
          }
          opzioniDimensione={OPZIONI_DIMENSIONE}
          unita="file"
          className="border-t border-dashed border-slate-200"
        />
      )}

      {anteprima?.idOlimpoCloud && (
        <PreviewImmaginePdf
          imageUrl={urlAnteprimaMateriale(anteprima.idOlimpoCloud)}
          totalPages={anteprima.pagine ?? 1}
          onClose={() => setAnteprima(null)}
        />
      )}
    </Sezione>
  );
}

export default FileFormato;
