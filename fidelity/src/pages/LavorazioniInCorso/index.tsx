import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Alert from "@/components/Base/Alert";
import { Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";

import ConfirmDialog from "@/components/ConfirmDialog";
import withSessionCheck from "@/components/SessionChecker";
import { descriviStato } from "@/constants/stati";
import { useNotification } from "@/context/NotificationContext";
import { useFetchLavorazioniInCorso } from "@/query/query";
import { formatData } from "@/utils/format";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { STATO_PROMO } from "../../../lib/enums";
import { ServerCall, type CustomError } from "../../../lib/server_call";
import { PromoResponseDTO } from "../../../server/core/dto";
import EmptyState from "../../components/EmptyState";
import PermissionGate from "../../components/PermissionGate";
import IntestazioneOrdinabile, { ARIA_SORT, type DirezioneOrdinamento } from "../shared/IntestazioneOrdinabile";

// Istanta non elimina definitivamente una promo con importazioni, tracciati o lavorazioni (I20-1052)
const RIFIUTI_ELIMINAZIONE_DEFINITIVA = [
  "importazioni_esistenti_per_questa_promo",
  "tracciati_esistenti_per_questa_promo",
  "lavorazioni_esistenti_per_questa_promo",
];

type SortField = 'nome' | 'data_scadenza' | 'validita_dal' | 'validita_al' | 'stato' | 'offset_visibilita';
type SortDirection = DirezioneOrdinamento;

// Campi su cui cercare: la ricerca filtra mentre si scrive
const CAMPI_RICERCA: { valore: SortField; etichetta: string }[] = [
  { valore: "nome", etichetta: "Nome promo" },
  { valore: "data_scadenza", etichetta: "Data di scadenza" },
  { valore: "validita_dal", etichetta: "Valida dal" },
  { valore: "validita_al", etichetta: "Valida al" },
  { valore: "stato", etichetta: "Stato" },
  { valore: "offset_visibilita", etichetta: "Offset visibilità" },
];

function Main() {
  const [showDialogEliminazione, setShowDialogEliminazione] = useState<{ show: boolean; idPromo: string; stato?: string; isDeletable?: boolean; numero_kit_collegati?: number; motivoRifiuto?: string }>();
  const [loadingEliminazione, setLoadingEliminazione] = useState(false);
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  // Stato per il filtro
  const [filter, setFilter] = useState({
    field: "nome",
    type: "like",
    value: "",
  });

  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Stato per l'ordinamento
  const [sortField, setSortField] = useState<SortField>('data_scadenza');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const data = useFetchLavorazioniInCorso();

  const deleteLavorazione = useMutation({
    mutationFn: async ({ id, stato, isDeletable }: { id: string; stato: string; isDeletable?: boolean }) => {
      let result;

      if (isDeletable) {
        result = await ServerCall.delete(`/promo/${id}`);
      } else {
        result = await ServerCall.delete(`/promo/${id}/stato/${stato}`);
      }

      if (result) {
        if (stato !== STATO_PROMO.ELIMINATA) {
          if (isDeletable) {
            showNotification(
              <div className="flex flex-row items-center">
                <Lucide icon="Check" className="text-success w-10 h-10" />
                <div className="ml-4 mr-4">
                  <div className="font-bold">Lavorazione eliminata definitivamente</div>
                  <div className="text-sm text-slate-500">La lavorazione è stata rimossa dal sistema</div>
                </div>
              </div>
            );
          } else {
            showNotification(
              <div className="flex flex-row items-center">
                <Lucide icon="Check" className="text-success w-10 h-10" />
                <div className="ml-4 mr-4">
                  <div className="font-bold">Lavorazione eliminata</div>
                  <div className="text-sm text-slate-500">La lavorazione è stata spostata nella sezione "Eliminate"</div>
                </div>
              </div>
            );
          }
        } else {
          showNotification(
            <div className="flex flex-row items-center">
              <Lucide icon="Check" className="text-success w-10 h-10" />
              <div className="ml-4 mr-4">
                <div className="font-bold">Lavorazione ripristinata</div>
                <div className="text-sm text-slate-500">La lavorazione è stata riportata in lavorazione</div>
              </div>
            </div>
          );
        }
      }
      return result;
    },
    mutationKey: ["deleteLavorazione"],
    onMutate: async () => {
      setLoadingEliminazione(true);
    },
    onSuccess: async () => {
      setLoadingEliminazione(false);
      setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 });
      data.refetch();
    },
    onError(error: CustomError, variables) {
      console.log(error);
      // Istanta rifiuta l'eliminazione definitiva: la modale resta aperta e propone quella non definitiva
      if (variables.isDeletable && RIFIUTI_ELIMINAZIONE_DEFINITIVA.includes(error?.details?.codice as string)) {
        setLoadingEliminazione(false);
        setShowDialogEliminazione((prev) => prev && { ...prev, isDeletable: false, motivoRifiuto: error.message });
        return;
      }
      if (error.httpStatus == 403) {
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleX" className="text-danger w-10 h-10" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Eliminazione negata</div>
              <div className="text-sm text-slate-500">Non hai i permessi per svolgere questa azione</div>
            </div>
          </div>
        );
      } else {
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleX" className="text-danger w-10 h-10" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Errore durante l&apos;eliminazione</div>
              <div className="text-sm text-slate-500">{error?.message || "Si è verificato un errore. Riprova o contatta il supporto."}</div>
            </div>
          </div>
        );
      }
      setLoadingEliminazione(false);
      setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 });
    }
  });

  // Filtra e ordina i dati
  const filteredData = useMemo(() => {
    const source = (data.data as PromoResponseDTO[]) || [];
    const filtered = filter.value
      ? source.filter((promo) => {
          const fieldValue = String(promo[filter.field as keyof PromoResponseDTO] || "").toLowerCase();
          const searchValue = filter.value.toLowerCase();
          if (filter.type === "like") {
            return fieldValue.includes(searchValue);
          }
          return fieldValue === searchValue;
        })
      : source;

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'nome':
          comparison = a.nome.localeCompare(b.nome);
          break;
        case 'data_scadenza':
          comparison = dayjs(a.data_scadenza).diff(dayjs(b.data_scadenza));
          break;
        case 'validita_dal':
          comparison = dayjs(a.validita_dal).diff(dayjs(b.validita_dal));
          break;
        case 'validita_al':
          comparison = dayjs(a.validita_al).diff(dayjs(b.validita_al));
          break;
        case 'stato':
          comparison = a.stato.localeCompare(b.stato);
          break;
        case 'offset_visibilita':
          comparison = (a.offset_visibilita ?? 0) - (b.offset_visibilita ?? 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data.data, filter, sortField, sortDirection]);

  // Calcola i dati paginati
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, pageSize]);

  // Ogni cambio del filtro riparte dalla prima pagina
  const cambiaFiltro = (modifica: Partial<typeof filter>) => {
    setFilter((precedente) => ({ ...precedente, ...modifica }));
    setCurrentPage(1);
  };

  const chiudiDialogEliminazione = () => setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 });

  const confermaDialogEliminazione = () => {
    setLoadingEliminazione(true);
    if (showDialogEliminazione) {
      deleteLavorazione.mutate({
        id: showDialogEliminazione.idPromo,
        stato: showDialogEliminazione.stato as string,
        isDeletable: showDialogEliminazione.isDeletable,
      });
    }
  };

  const apriDialogEliminazione = (promo: PromoResponseDTO) =>
    setShowDialogEliminazione({
      show: true,
      idPromo: promo.id,
      stato: promo.stato,
      isDeletable: promo.is_deletable,
      numero_kit_collegati: promo.numero_kit_collegati,
    });

  const onResetFilter = () => {
    setFilter({
      field: "nome",
      type: "like",
      value: "",
    });
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // aria-sort va sul th; direzione e click sul pulsante dentro il th
  const ariaSort = (field: SortField) => (sortField === field ? ARIA_SORT[sortDirection] : undefined);
  const ordinamento = (field: SortField) => ({
    direzione: sortField === field ? sortDirection : undefined,
    onClick: () => handleSort(field),
  });

  // Funzioni per l'export
  const onExportCsv = () => {
    const csvData = filteredData.map((promo) => ({
      "Nome Lavorazione": promo.nome,
      "Data di scadenza": formatData(promo.data_scadenza),
      "Valida dal": formatData(promo.validita_dal),
      "Valida al": formatData(promo.validita_al),
      "Stato": descriviStato("promo", promo.stato).etichetta,
      "Offset visibilità": `${promo.offset_visibilita} giorni`,
    }));

    const csv = [
      Object.keys(csvData[0] || {}).join(","),
      ...csvData.map((row) => Object.values(row).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.csv";
    a.click();
  };

  const onExportJson = () => {
    const json = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
  };

  const onExportXlsx = async () => {
    // xlsx (~320 KB) si scarica solo quando si esporta, non con la pagina
    const xlsx = await import("xlsx");
    const wsData = filteredData.map((promo) => ({
      "Nome Lavorazione": promo.nome,
      "Data di scadenza": formatData(promo.data_scadenza),
      "Valida dal": formatData(promo.validita_dal),
      "Valida al": formatData(promo.validita_al),
      "Stato": descriviStato("promo", promo.stato).etichetta,
      "Offset visibilità": `${promo.offset_visibilita} giorni`,
    }));

    const ws = xlsx.utils.json_to_sheet(wsData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "PromoData");
    xlsx.writeFile(wb, "data.xlsx");
  };

  const onExportHtml = () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Promozioni in corso</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Promozioni in corso</h1>
          <table>
            <thead>
              <tr>
                <th>Nome Lavorazione</th>
                <th>Data di scadenza</th>
                <th>Valida dal</th>
                <th>Valida al</th>
                <th>Stato</th>
                <th>Offset visibilità</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map((promo) => `
                <tr>
                  <td>${promo.nome}</td>
                  <td>${formatData(promo.data_scadenza)}</td>
                  <td>${formatData(promo.validita_dal)}</td>
                  <td>${formatData(promo.validita_al)}</td>
                  <td>${descriviStato("promo", promo.stato).etichetta}</td>
                  <td>${promo.offset_visibilita} giorni</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.html";
    a.click();
  };

  const onPrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Promozioni in corso</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Promozioni in corso</h1>
          <table>
            <thead>
              <tr>
                <th>Nome Lavorazione</th>
                <th>Data di scadenza</th>
                <th>Valida dal</th>
                <th>Valida al</th>
                <th>Stato</th>
                <th>Offset visibilità</th>
              </tr>
            </thead>
            <tbody>
              ${filteredData.map((promo) => `
                <tr>
                  <td>${promo.nome}</td>
                  <td>${formatData(promo.data_scadenza)}</td>
                  <td>${formatData(promo.validita_dal)}</td>
                  <td>${formatData(promo.validita_al)}</td>
                  <td>${descriviStato("promo", promo.stato).etichetta}</td>
                  <td>${promo.offset_visibilita} giorni</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const dialog = showDialogEliminazione;
  const kitCollegati = dialog?.numero_kit_collegati ?? 0;
  const ripristino = dialog?.stato === STATO_PROMO.ELIMINATA;
  const filtroAttivo = filter.value !== "";

  return (
    <>
      <ConfirmDialog
        open={Boolean(dialog?.show)}
        onClose={chiudiDialogEliminazione}
        onConfirm={confermaDialogEliminazione}
        loading={loadingEliminazione}
        confirmVariant={ripristino ? "primary" : "danger"}
        title={ripristino ? "Ripristina lavorazione" : dialog?.isDeletable ? "Eliminazione definitiva" : "Elimina lavorazione"}
        subtitle={ripristino ? "Torna in lavorazione" : dialog?.isDeletable ? "Azione irreversibile" : "Si potrà ripristinare"}
        confirmLabel={ripristino ? "Ripristina" : dialog?.isDeletable ? "Elimina definitivamente" : "Elimina"}
        description={
          ripristino ? (
            <p>Questa lavorazione è attualmente eliminata. Vuoi ripristinarla e riportarla in lavorazione?</p>
          ) : dialog?.isDeletable ? (
            <div className="flex flex-col gap-3">
              <p>
                Stai per eliminare definitivamente questa lavorazione.{" "}
                <span className="font-medium text-danger">Questa azione non può essere annullata.</span>
              </p>
              {kitCollegati > 0 && (
                <Alert variant="soft-danger" icona="CircleAlert" titolo={`${kitCollegati} kit collegati`}>
                  Questa lavorazione ha {kitCollegati} kit associati che verranno eliminati definitivamente insieme alla lavorazione.
                </Alert>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {dialog?.motivoRifiuto && (
                <Alert variant="soft-danger" icona="CircleAlert" titolo="Eliminazione definitiva non possibile">
                  {dialog.motivoRifiuto}
                </Alert>
              )}
              <p>
                Sei sicuro di voler eliminare questa lavorazione? La lavorazione verrà spostata nella sezione
                &quot;Eliminate&quot; e potrà essere ripristinata.
              </p>
              {kitCollegati > 0 && (
                <Alert variant="soft-warning" icona="Package" titolo={`${kitCollegati} kit collegati`}>
                  Questa lavorazione ha {kitCollegati} kit associati che potrebbero essere influenzati dall&apos;eliminazione.
                </Alert>
              )}
            </div>
          )
        }
      />
      <Pagina titolo="Promozioni in corso" descrizione="Gestione lavorazioni in corso">
        <Sezione senzaPadding aria-label="Elenco delle promozioni in corso">
          <BarraFiltri
            destra={
              <>
                <Button size="sm" variant="outline-secondary" onClick={onPrint}>
                  <Lucide icon="Printer" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Stampa
                </Button>
                <Menu>
                  <Menu.Button as={Button} size="sm" variant="outline-secondary">
                    <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Esporta
                    <Lucide icon="ChevronDown" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                  </Menu.Button>
                  <Menu.Items className="w-40">
                    <Menu.Item onClick={onExportCsv}>
                      <Lucide icon="FileText" aria-hidden="true" className="mr-2 h-4 w-4" /> Export CSV
                    </Menu.Item>
                    <Menu.Item onClick={onExportJson}>
                      <Lucide icon="FileCode" aria-hidden="true" className="mr-2 h-4 w-4" /> Export JSON
                    </Menu.Item>
                    <Menu.Item onClick={onExportXlsx}>
                      <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-2 h-4 w-4" /> Export XLSX
                    </Menu.Item>
                    <Menu.Item onClick={onExportHtml}>
                      <Lucide icon="Globe" aria-hidden="true" className="mr-2 h-4 w-4" /> Export HTML
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
              </>
            }
          >
            <FormSelect
              formSelectSize="sm"
              aria-label="Cerca per"
              className="sm:w-48"
              value={filter.field}
              onChange={(e) => cambiaFiltro({ field: e.target.value })}
            >
              {CAMPI_RICERCA.map((campo) => (
                <option key={campo.valore} value={campo.valore}>
                  {campo.etichetta}
                </option>
              ))}
            </FormSelect>
            <CampoRicerca
              etichetta="Cerca promozioni"
              value={filter.value}
              onChange={(valore) => cambiaFiltro({ value: valore })}
            />
          </BarraFiltri>

          {data.isLoading ? (
            <div className="flex justify-center px-5 py-12">
              <Spinner size="lg" etichetta="Caricamento delle lavorazioni in corso" />
            </div>
          ) : data.isError ? (
            <PageError
              compatta
              className="m-5"
              titolo="Lavorazioni non caricate"
              motivo={data.error?.message || "Impossibile caricare le lavorazioni in corso."}
              onRiprova={() => data.refetch()}
            />
          ) : filteredData.length === 0 ? (
            filtroAttivo ? (
              <EmptyState
                compatta
                icon="SearchX"
                title="Nessun risultato"
                description="Nessuna lavorazione in corso corrisponde alla ricerca."
                buttonText="Azzera ricerca"
                buttonIcon="RotateCcw"
                onButtonClick={onResetFilter}
              />
            ) : (
              <EmptyState
                compatta
                icon="CircleAlert"
                title="Nessuna lavorazione in corso"
                description="Le promozioni create compariranno qui finché sono in lavorazione."
              />
            )
          ) : (
            <>
              <div className="hidden overflow-x-auto xl:block">
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th aria-sort={ariaSort("nome")}>
                        <IntestazioneOrdinabile {...ordinamento("nome")}>Nome lavorazione</IntestazioneOrdinabile>
                      </Table.Th>
                      <Table.Th aria-sort={ariaSort("data_scadenza")}>
                        <IntestazioneOrdinabile {...ordinamento("data_scadenza")}>Scadenza</IntestazioneOrdinabile>
                      </Table.Th>
                      <Table.Th aria-sort={ariaSort("validita_dal")}>
                        <IntestazioneOrdinabile {...ordinamento("validita_dal")}>Valida dal</IntestazioneOrdinabile>
                      </Table.Th>
                      <Table.Th aria-sort={ariaSort("validita_al")}>
                        <IntestazioneOrdinabile {...ordinamento("validita_al")}>Valida al</IntestazioneOrdinabile>
                      </Table.Th>
                      <Table.Th aria-sort={ariaSort("stato")}>
                        <IntestazioneOrdinabile {...ordinamento("stato")}>Stato</IntestazioneOrdinabile>
                      </Table.Th>
                      <Table.Th aria-sort={ariaSort("offset_visibilita")}>
                        <IntestazioneOrdinabile {...ordinamento("offset_visibilita")}>Visibilità</IntestazioneOrdinabile>
                      </Table.Th>
                      <Table.Th className="text-right">
                        <span className="sr-only">Azioni</span>
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {paginatedData.map((promo) => (
                      <Table.Tr key={promo.id}>
                        <Table.Td className="min-w-48">
                          <div className="whitespace-nowrap font-medium text-slate-800 dark:text-slate-100">{promo.nome}</div>
                          <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">ID: {promo.id.slice(0, 8)}</div>
                        </Table.Td>
                        <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">{formatData(promo.data_scadenza)}</Table.Td>
                        <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">{formatData(promo.validita_dal)}</Table.Td>
                        <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">{formatData(promo.validita_al)}</Table.Td>
                        <Table.Td>
                          <StatusBadge dominio="promo" stato={promo.stato} />
                        </Table.Td>
                        <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">{promo.offset_visibilita} giorni</Table.Td>
                        <Table.Td>
                          {promo.stato !== "ELIMINATA" ? (
                            <div className="flex items-center justify-end gap-2">
                              <PermissionGate permission="promo.visualizza">
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                                >
                                  Visualizza
                                  <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                                </Button>
                              </PermissionGate>
                              <PermissionGate permission="promo.elimina">
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  aria-label={`Elimina ${promo.nome}`}
                                  title="Elimina"
                                  onClick={() => apriDialogEliminazione(promo)}
                                >
                                  <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                                </Button>
                              </PermissionGate>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                              >
                                Dettagli
                                <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                aria-label={`Ripristina ${promo.nome}`}
                                title="Ripristina"
                                onClick={() => apriDialogEliminazione(promo)}
                              >
                                <Lucide icon="Undo" aria-hidden="true" className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>

              {/* Sotto xl le righe diventano schede */}
              <ul className="xl:hidden">
                {paginatedData.map((promo) => (
                  <li key={promo.id} className="border-b border-slate-100 px-5 py-4 dark:border-darkmode-400">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words font-medium text-slate-800 dark:text-slate-100">{promo.nome}</div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">ID: {promo.id.slice(0, 8)}</div>
                      </div>
                      <StatusBadge dominio="promo" stato={promo.stato} />
                    </div>
                    <dl className="mb-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="title-eyebrow">Scadenza</dt>
                        <dd className="tabular-nums text-slate-700 dark:text-slate-300">{formatData(promo.data_scadenza)}</dd>
                      </div>
                      <div>
                        <dt className="title-eyebrow">Visibilità</dt>
                        <dd className="tabular-nums text-slate-700 dark:text-slate-300">{promo.offset_visibilita} giorni</dd>
                      </div>
                      <div>
                        <dt className="title-eyebrow">Valida dal</dt>
                        <dd className="tabular-nums text-slate-700 dark:text-slate-300">{formatData(promo.validita_dal)}</dd>
                      </div>
                      <div>
                        <dt className="title-eyebrow">Valida al</dt>
                        <dd className="tabular-nums text-slate-700 dark:text-slate-300">{formatData(promo.validita_al)}</dd>
                      </div>
                    </dl>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {promo.stato !== "ELIMINATA" ? (
                        <>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                          >
                            Visualizza
                            <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline-danger" size="sm" className="flex-1" onClick={() => apriDialogEliminazione(promo)}>
                            <Lucide icon="Trash2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                            Elimina
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                          >
                            Dettagli
                            <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline-secondary" size="sm" className="flex-1" onClick={() => apriDialogEliminazione(promo)}>
                            <Lucide icon="Undo" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                            Ripristina
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              <PaginazioneTabella
                totale={filteredData.length}
                pagina={currentPage}
                dimensionePagina={pageSize}
                onCambiaPagina={setCurrentPage}
                onCambiaDimensione={setPageSize}
              />
            </>
          )}
        </Sezione>
      </Pagina>
    </>
  );
}

export default withSessionCheck(Main);
