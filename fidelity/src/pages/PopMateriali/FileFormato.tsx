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
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { descriviStato } from "@/constants/stati";
import { useNotification } from "@/context/NotificationContext";
import { useRicercaDifferita } from "@/hooks/useRicercaDifferita";
import { useFetchFilePop } from "@/query/query";
import { formatNumero, VALORE_ASSENTE } from "@/utils/format";
import { articoloPlurale, urlAnteprimaMateriale } from "@/utils/materiali";
import { twMerge } from "@/utils/twMerge";
import { useEffect, useRef, useState } from "react";
import { STATO_LOG_FILE } from "../../../lib/enums";
import type { PeriodoMateriali } from "../../../lib/materiali/periodi";
import { DIMENSIONI_PAGINA_POP, type FilePop, type FormatoPop, type PromoMateriali } from "../../../lib/materiali/tipi";
import { filtriPerZip, MOTIVO_SENZA_DOWNLOAD, nomeZip, scaricaZipSelezionati, urlFileSingolo, urlZipFormato } from "./scaricamenti";

interface FiltriFile {
  cerca: string;
  stato: STATO_LOG_FILE | "";
  idArea: string;
  idCanale: string;
  reparto: string;
}

const FILTRI_VUOTI: FiltriFile = { cerca: "", stato: "", idArea: "", idCanale: "", reparto: "" };

const OPZIONI_DIMENSIONE = [...DIMENSIONI_PAGINA_POP];
const DIMENSIONE_PREDEFINITA = OPZIONI_DIMENSIONE[0];
const NUMERO_COLONNE = 6;

const isStatoFile = (valore: string): valore is STATO_LOG_FILE =>
  (Object.values(STATO_LOG_FILE) as string[]).includes(valore);

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

function RigheInCaricamento() {
  return (
    <>
      {Array.from({ length: 8 }, (_, indice) => (
        <Table.Tr key={indice}>
          {Array.from({ length: NUMERO_COLONNE }, (_, colonna) => (
            <Table.Td key={colonna}>
              <Skeleton className={colonna === 0 ? "h-4 w-4" : "h-4"} />
            </Table.Td>
          ))}
        </Table.Tr>
      ))}
    </>
  );
}

interface FileFormatoProps {
  promo: PromoMateriali;
  periodo: PeriodoMateriali;
  formato: FormatoPop;
  puoScaricare: boolean;
}

/**
 * File di un formato POP, caricati a pagine dal server: filtri, selezione per lo ZIP (i file
 * scelti, oppure tutti quelli che corrispondono ai filtri), anteprima e download del singolo file.
 */
function FileFormato({ promo, periodo, formato, puoScaricare }: FileFormatoProps) {
  const { showNotification } = useNotification();
  const [filtri, setFiltri] = useState<FiltriFile>(FILTRI_VUOTI);
  const [pagina, setPagina] = useState(1);
  const [dimensione, setDimensione] = useState(DIMENSIONE_PREDEFINITA);
  const [selezionati, setSelezionati] = useState<ReadonlySet<string>>(new Set());
  // Tutti i file che corrispondono ai filtri, anche quelli delle altre pagine
  const [tuttiSelezionati, setTuttiSelezionati] = useState(false);
  const [scaricamento, setScaricamento] = useState(false);
  const [anteprima, setAnteprima] = useState<FilePop | null>(null);

  const annullaSelezione = () => {
    setSelezionati(new Set());
    setTuttiSelezionati(false);
  };

  // Con filtri nuovi la selezione non varrebbe più per i file mostrati: si riparte da zero
  const cambiaFiltri = (modifiche: Partial<FiltriFile>) => {
    setFiltri((attuali) => ({ ...attuali, ...modifiche }));
    setPagina(1);
    annullaSelezione();
  };
  const [testoRicerca, setTestoRicerca] = useRicercaDifferita(filtri.cerca, (testo) => cambiaFiltri({ cerca: testo }));

  const azzeraFiltri = () => {
    setTestoRicerca("");
    cambiaFiltri(FILTRI_VUOTI);
  };

  const filtriAttivi = {
    cerca: filtri.cerca || undefined,
    stato: filtri.stato || undefined,
    idArea: filtri.idArea || undefined,
    idCanale: filtri.idCanale || undefined,
    reparto: filtri.reparto || undefined,
  };
  const conFiltri = Object.values(filtriAttivi).some(Boolean);

  const query = useFetchFilePop(promo.id, { periodo, idFormato: formato.id, ...filtriAttivi, pagina, dimensione });
  const dati = query.data;
  const file = dati?.file ?? [];
  const totale = dati?.totale ?? 0;

  // Una pagina oltre l'ultima (file spariti nel frattempo) torna alla prima
  useEffect(() => {
    if (dati && !query.isPlaceholderData && dati.file.length === 0 && dati.totale > 0 && pagina > 1) setPagina(1);
  }, [dati, query.isPlaceholderData, pagina]);

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

  const scaricaSelezionati = async () => {
    if (!puoScaricare || selezionati.size === 0 || scaricamento) return;
    setScaricamento(true);
    try {
      await scaricaZipSelezionati(
        promo.id,
        { periodo, idFormato: formato.id, idFile: [...selezionati] },
        nomeZip(promo.nome, formato.nome)
      );
    } catch (errore) {
      showNotification((errore as Error)?.message || "Download dei file non riuscito", { variant: "error" });
    } finally {
      setScaricamento(false);
    }
  };

  const nomeDi = (elenco: { id: string; nome: string }[] | undefined, id: string) =>
    elenco?.find((voce) => voce.id === id)?.nome ?? id;

  // Riepilogo dei filtri nello stato vuoto: Ricerca «…» · Stato «…» · Area «…»
  const riepilogoFiltri = [
    filtri.cerca && `Ricerca «${filtri.cerca}»`,
    filtri.stato && `Stato «${descriviStato("fileKit", filtri.stato).etichetta}»`,
    filtri.idArea && `Area «${nomeDi(dati?.opzioni.aree, filtri.idArea)}»`,
    filtri.idCanale && `Canale «${nomeDi(dati?.opzioni.canali, filtri.idCanale)}»`,
    filtri.reparto && `Reparto «${filtri.reparto}»`,
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
            <Button
              as="a"
              href={urlZipFormato(promo.id, periodo, formato.id, filtriPerZip(filtriAttivi))}
              download
              size="sm"
              variant="primary"
            >
              <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Scarica ZIP
            </Button>
          ) : (
            comandoSenzaPermesso("Scarica ZIP", "Download")
          )
        ) : puoScaricare ? (
          <Button type="button" size="sm" variant="primary" onClick={scaricaSelezionati} loading={scaricamento}>
            {!scaricamento && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
            Scarica selezionati
          </Button>
        ) : (
          comandoSenzaPermesso("Scarica selezionati", "Download")
        )}
        {!tuttiSelezionati && totale > file.length && (
          <Button type="button" size="sm" variant="outline-secondary" onClick={() => setTuttiSelezionati(true)}>
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

  const corpoTabella = (() => {
    if (query.isError) {
      return (
        <Table.Tr>
          <Table.Td colSpan={NUMERO_COLONNE}>
            <PageError
              compatta
              titolo="File non caricati"
              motivo={query.error?.message || "Il servizio non ha restituito i file del formato."}
              onRiprova={() => query.refetch()}
            />
          </Table.Td>
        </Table.Tr>
      );
    }
    if (!dati) return <RigheInCaricamento />;
    if (dati.totale === 0) {
      return (
        <Table.Tr>
          <Table.Td colSpan={NUMERO_COLONNE} className="p-0">
            {conFiltri ? (
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
            )}
          </Table.Td>
        </Table.Tr>
      );
    }
    return dati.file.map((voce) => {
      const referenza = [voce.referenza?.codice, voce.reparto].filter(Boolean).join(" · ");
      return (
        <Table.Tr key={voce.id}>
          <Table.Td className="w-10">
            <FormCheck.Input
              type="checkbox"
              aria-label={`Seleziona ${voce.nome}`}
              checked={tuttiSelezionati || selezionati.has(voce.id)}
              disabled={tuttiSelezionati}
              onChange={(evento) => selezionaFile(voce.id, evento.target.checked)}
            />
          </Table.Td>
          <Table.Td className="min-w-48">
            <div className="break-all font-medium text-slate-700">{voce.nome}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {voce.area.nome} · {voce.canale.nome}
            </div>
          </Table.Td>
          <Table.Td className="min-w-48">
            <div className="text-slate-700">{voce.referenza?.descrizione || VALORE_ASSENTE}</div>
            {referenza && <div className="mt-0.5 text-xs tabular-nums text-slate-500">{referenza}</div>}
          </Table.Td>
          <Table.Td>
            {voce.stato ? (
              <StatusBadge dominio="fileKit" stato={voce.stato} />
            ) : (
              <span className="text-slate-400">{VALORE_ASSENTE}</span>
            )}
          </Table.Td>
          <Table.Td className="tabular-nums text-slate-600">
            {voce.versione !== null && voce.versione !== undefined ? `v${voce.versione}` : VALORE_ASSENTE}
          </Table.Td>
          <Table.Td className="text-right">
            <div className="flex justify-end gap-1.5">
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
            </div>
          </Table.Td>
        </Table.Tr>
      );
    });
  })();

  return (
    <Sezione
      senzaPadding
      titolo={`File del formato ${formato.nome} · ${formatNumero(formato.numeroFile)} file`}
      descrizione="I file si caricano una pagina alla volta; i filtri valgono anche per lo ZIP di tutti i file trovati."
    >
      <BarraFiltri
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
          placeholder="Nome file, codice o referenza…"
          value={testoRicerca}
          onChange={setTestoRicerca}
        />
        <FormSelect
          formSelectSize="sm"
          aria-label="Stato file"
          className="sm:w-44"
          value={filtri.stato}
          onChange={(evento) => cambiaFiltri({ stato: isStatoFile(evento.target.value) ? evento.target.value : "" })}
        >
          <option value="">Tutti gli stati</option>
          {Object.values(STATO_LOG_FILE).map((stato) => (
            <option key={stato} value={stato}>
              {descriviStato("fileKit", stato).etichetta}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          formSelectSize="sm"
          aria-label="Area"
          className="sm:w-36"
          value={filtri.idArea}
          onChange={(evento) => cambiaFiltri({ idArea: evento.target.value })}
        >
          <option value="">Tutte le aree</option>
          {dati?.opzioni.aree.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nome}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          formSelectSize="sm"
          aria-label="Canale"
          className="sm:w-36"
          value={filtri.idCanale}
          onChange={(evento) => cambiaFiltri({ idCanale: evento.target.value })}
        >
          <option value="">Tutti i canali</option>
          {dati?.opzioni.canali.map((canale) => (
            <option key={canale.id} value={canale.id}>
              {canale.nome}
            </option>
          ))}
        </FormSelect>
        <FormSelect
          formSelectSize="sm"
          aria-label="Reparto"
          className="sm:w-36"
          value={filtri.reparto}
          onChange={(evento) => cambiaFiltri({ reparto: evento.target.value })}
        >
          <option value="">Tutti i reparti</option>
          {dati?.opzioni.reparti.map((reparto) => (
            <option key={reparto} value={reparto}>
              {reparto}
            </option>
          ))}
        </FormSelect>
      </BarraFiltri>

      {barraSelezione}

      <div
        className={twMerge("overflow-x-auto transition-opacity", query.isPlaceholderData && "opacity-60")}
        aria-busy={!dati || query.isPlaceholderData || undefined}
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="w-10">
                <CasellaPagina
                  selezionata={tuttiSelezionati || paginaSelezionata}
                  parziale={!tuttiSelezionati && paginaParziale}
                  disabled={tuttiSelezionati || file.length === 0}
                  onChange={selezionaPagina}
                />
              </Table.Th>
              <Table.Th>File</Table.Th>
              <Table.Th>Referenza</Table.Th>
              <Table.Th>Stato</Table.Th>
              <Table.Th>Ver.</Table.Th>
              <Table.Th className="text-right">
                <span className="sr-only">Azioni</span>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{corpoTabella}</Table.Tbody>
        </Table>
      </div>

      {dati && !query.isError && (
        <PaginazioneTabella
          totale={totale}
          pagina={pagina}
          dimensionePagina={dimensione}
          onCambiaPagina={setPagina}
          onCambiaDimensione={(nuova) => {
            setDimensione(nuova);
            setPagina(1);
          }}
          opzioniDimensione={OPZIONI_DIMENSIONE}
          className="border-t border-dashed border-slate-200"
        />
      )}

      {anteprima?.idOlimpoCloud && (
        <PreviewImmaginePdf
          imageUrl={urlAnteprimaMateriale(anteprima.idOlimpoCloud)}
          totalPages={1}
          onClose={() => setAnteprima(null)}
        />
      )}
    </Sezione>
  );
}

export default FileFormato;
