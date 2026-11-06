import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormLabel, FormSelect } from "@/components/Base/Form";
import { Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import withSessionCheck from "@/components/SessionChecker";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/context/PermissionContext";
import { useDebounce } from "@/hooks/useDebounce";
import { useContenutiDigitali, useOpzioniContenutiDigitali } from "@/query/consultazione";
import { MOTIVO_SENZA_PERMESSO_SCARICA, useScaricaFileConsultazione } from "@/utils/scaricaFileConsultazione";
import React, { useState } from "react";
import { ItemDisposition } from "../../../lib/enums";
import type { ContenutoDigitale, FiltriContenutiDigitali, Riferimento } from "../../../lib/consultazione/tipi";

/** Filtri del pannello Filtra; la ricerca per nome ha il suo campo. */
type CampoFiltro = "idPromo" | "idTipoExport" | "idFormato" | "idArea" | "idCanale";

const SENZA_FILTRI: Record<CampoFiltro, string> = { idPromo: "", idTipoExport: "", idFormato: "", idArea: "", idCanale: "" };

const OPZIONI_DIMENSIONE = [10, 25, 35, 50];

const iconaDelFile = (nomeFile: string) => {
  const estensione = nomeFile.split(".").pop()?.toLowerCase();
  switch (estensione) {
    case "pdf":
      return "FileType";
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
      return "Image";
    case "doc":
    case "docx":
      return "FileText";
    case "xls":
    case "xlsx":
      return "FileSpreadsheet";
    case "zip":
    case "rar":
      return "FileArchive";
    default:
      return "File";
  }
};

/**
 * Contenuti digitali: i file dei kit manuali pubblicati della GDO, dalle API di consultazione.
 * Consultarli chiede "materiali.visualizza", scaricarli "materiali.scarica".
 */
const ContenutiDigitali: React.FC = () => {
  const [itemDisposition] = useState(ItemDisposition.grid);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(OPZIONI_DIMENSIONE[0]);
  const [filtri, setFiltri] = useState<Record<CampoFiltro, string>>(SENZA_FILTRI);
  const [cerca, setCerca] = useState("");
  const [testoRicerca, setTestoRicerca] = useState("");
  // La ricerca parte 300 ms dopo l'ultima battuta e riparte dalla prima pagina
  const applicaRicerca = useDebounce((testo: string) => {
    setCerca(testo.trim());
    setPage(1);
  }, 300);

  const richiesta: FiltriContenutiDigitali = { ...filtri, cerca, pagina: page, dimensione: pageSize };
  const contenuti = useContenutiDigitali(richiesta);
  const opzioni = useOpzioniContenutiDigitali();
  const puoScaricare = usePermission(PERMISSIONS.MATERIALI.SCARICA);
  const { inCorso, scarica } = useScaricaFileConsultazione();

  const filtriAttivi = Object.values(filtri).filter(Boolean).length;

  const azzeraFiltri = () => {
    setTestoRicerca("");
    setCerca("");
    setFiltri(SENZA_FILTRI);
    setPage(1);
  };

  // Ogni filtro del pannello riparte dalla prima pagina
  const impostaFiltro = (campo: CampoFiltro, valore: string) => {
    setFiltri((precedenti) => ({ ...precedenti, [campo]: valore }));
    setPage(1);
  };

  const cambiaDimensione = (dimensione: number) => {
    setPageSize(dimensione);
    setPage(1);
  };

  const renderLoadingState = () => {
    const segnaposto = Array.from({ length: pageSize }, (_, indice) => `segnaposto-${indice}`);
    if (itemDisposition === ItemDisposition.grid) {
      return (
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {segnaposto.map((chiave) => (
            <div key={chiave} className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-3">
              <Skeleton className="h-40 rounded-control" />
              <Skeleton className="h-4" />
              <Skeleton className="h-8 w-1/2 rounded-control" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="divide-y divide-slate-100 px-5" aria-busy="true">
        {segnaposto.map((chiave) => (
          <div key={chiave} className="flex items-center gap-3 py-3">
            <Skeleton className="h-10 w-10 flex-none rounded-control" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-8 w-24 rounded-control" />
          </div>
        ))}
      </div>
    );
  };

  const filtriSelezionabili: { campo: CampoFiltro; etichetta: string; vuoto: string; opzioni: Riferimento[] }[] = [
    { campo: "idPromo", etichetta: "Promozione", vuoto: "Tutte le promozioni", opzioni: opzioni.data?.promozioni ?? [] },
    { campo: "idTipoExport", etichetta: "Tipo di export", vuoto: "Tutti i tipi di export", opzioni: opzioni.data?.tipiExport ?? [] },
    { campo: "idFormato", etichetta: "Formato", vuoto: "Tutti i formati", opzioni: opzioni.data?.formati ?? [] },
    { campo: "idArea", etichetta: "Area", vuoto: "Tutte le aree", opzioni: opzioni.data?.aree ?? [] },
    { campo: "idCanale", etichetta: "Canale", vuoto: "Tutti i canali", opzioni: opzioni.data?.canali ?? [] },
  ];

  const elencoFile = contenuti.data?.file ?? [];
  const ricercaAttiva = Boolean(cerca) || filtriAttivi > 0;

  const comandoScarica = (file: ContenutoDigitale, className: string) => (
    <Button
      onClick={() => scarica(file.id, file.nome)}
      variant="outline-secondary"
      size="sm"
      className={className}
      aria-label={`Scarica ${file.nome}`}
      disabled={!puoScaricare || Boolean(inCorso)}
      loading={inCorso === file.id}
      title={!puoScaricare ? MOTIVO_SENZA_PERMESSO_SCARICA : undefined}
    >
      {inCorso !== file.id && <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
      Scarica
    </Button>
  );

  const anteprima = (file: ContenutoDigitale, classeImmagine: string, classeIcona: string) =>
    file.anteprima ? (
      <img
        src={file.anteprima}
        alt=""
        className={classeImmagine}
        onLoad={(e) => (e.currentTarget.style.opacity = "1")}
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "";
        }}
        style={{ opacity: "0", transition: "opacity 0.3s ease-in-out" }}
        loading="lazy"
      />
    ) : (
      <Lucide icon={iconaDelFile(file.nome)} aria-hidden="true" className={classeIcona} />
    );

  return (
    <Pagina titolo="Contenuti digitali" descrizione="Volantini e materiali pubblicati, da cercare e scaricare">
      <Sezione senzaPadding aria-label="Contenuti digitali">
        <BarraFiltri
          destra={
            <Popover className="inline-block">
              {({ close }) => (
                <>
                  <Popover.Button as={Button} size="sm" variant="outline-secondary" className="w-full sm:w-auto">
                    <Lucide icon="ArrowDownWideNarrow" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Filtra
                    {/* Spazi come testo, fuori dagli span: dentro si perdono e il nome letto diventa "Filtra1filtri attivi" */}
                    {filtriAttivi > 0 && " "}
                    {filtriAttivi > 0 && (
                      <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-2xs font-medium tabular-nums text-slate-600">
                        {filtriAttivi}
                        {" "}
                        <span className="sr-only">filtri attivi</span>
                      </span>
                    )}
                  </Popover.Button>

                  <Popover.Panel placement="bottom-end" className="mt-2">
                    <div className="flex w-72 flex-col gap-3 p-2">
                      {filtriSelezionabili.map((filtro) => (
                        <div key={filtro.campo}>
                          <FormLabel htmlFor={`filtro-${filtro.campo}`}>{filtro.etichetta}</FormLabel>
                          <FormSelect
                            id={`filtro-${filtro.campo}`}
                            formSelectSize="sm"
                            value={filtri[filtro.campo]}
                            onChange={(e) => impostaFiltro(filtro.campo, e.target.value)}
                          >
                            <option value="">{filtro.vuoto}</option>
                            {filtro.opzioni.map((opzione) => (
                              <option key={opzione.id} value={opzione.id}>
                                {opzione.nome}
                              </option>
                            ))}
                          </FormSelect>
                        </div>
                      ))}

                      <div className="mt-1 flex justify-end gap-2">
                        <Button size="sm" variant="outline-secondary" onClick={azzeraFiltri}>
                          <Lucide icon="RefreshCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                          Reset
                        </Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => close()}>
                          Chiudi
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            contenuti.refetch();
                            close();
                          }}
                        >
                          Filtra
                        </Button>
                      </div>
                    </div>
                  </Popover.Panel>
                </>
              )}
            </Popover>
          }
        >
          <CampoRicerca
            etichetta="Cerca contenuti"
            placeholder="Ricerca contenuti…"
            value={testoRicerca}
            onChange={(valore) => {
              setTestoRicerca(valore);
              applicaRicerca(valore);
            }}
          />
        </BarraFiltri>

        {contenuti.isError ? (
          <PageError
            compatta
            className="m-5"
            titolo="Contenuti non caricati"
            motivo={contenuti.error?.message || "Si è verificato un errore durante il recupero dei contenuti digitali."}
            onRiprova={() => contenuti.refetch()}
          />
        ) : contenuti.isLoading ? (
          renderLoadingState()
        ) : elencoFile.length === 0 ? (
          ricercaAttiva ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Nessun risultato"
              description="Nessun contenuto corrisponde alla ricerca o ai filtri scelti."
              buttonText="Azzera filtri"
              buttonIcon="RotateCcw"
              onButtonClick={azzeraFiltri}
            />
          ) : (
            <EmptyState
              compatta
              icon="FileX"
              title="Nessun contenuto trovato"
              description="Al momento non ci sono contenuti pubblicati."
            />
          )
        ) : itemDisposition === ItemDisposition.grid ? (
          <ul className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {elencoFile.map((file) => (
              <li key={file.id} className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-3">
                <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-slate-50">
                  {anteprima(file, "h-full w-full object-scale-down", "h-12 w-12 text-slate-400")}
                </div>
                <p className="truncate text-sm font-medium text-slate-700" title={file.nome}>
                  {file.nome}
                </p>
                {comandoScarica(file, "self-start")}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-slate-100 px-5">
            {elencoFile.map((file) => (
              <li key={file.id} className="flex items-center gap-3 py-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-control border border-slate-200 bg-white">
                  {anteprima(file, "h-full w-full object-contain p-1", "h-5 w-5 text-slate-400")}
                </div>
                <p className="min-w-0 flex-grow truncate text-sm font-medium text-slate-700">{file.nome}</p>
                {comandoScarica(file, "whitespace-nowrap")}
              </li>
            ))}
          </ul>
        )}

        <PaginazioneTabella
          totale={contenuti.data?.totale ?? 0}
          pagina={page}
          dimensionePagina={pageSize}
          onCambiaPagina={setPage}
          onCambiaDimensione={cambiaDimensione}
          opzioniDimensione={OPZIONI_DIMENSIONE}
        />
      </Sezione>
    </Pagina>
  );
};

export default withSessionCheck(ContenutiDigitali);
