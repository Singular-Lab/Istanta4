import Button from "@/components/Base/Button";
import { FormInline, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import { Dialog, Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Pagination from "@/components/Base/Pagination";
import Table from "@/components/Base/Table";

import withSessionCheck from "@/components/SessionChecker";
import { useNotification } from "@/context/NotificationContext";
import { useFetchLavorazioniInCorso } from "@/query/query";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as xlsx from "xlsx";
import { STATO_PROMO } from "../../../lib/enums";
import { ServerCall, type CustomError } from "../../../lib/server_call";
import { PromoResponseDTO } from "../../../server/core/dto";
import EmptyState from "../../components/EmptyState";
import PermissionGate from "../../components/PermissionGate";

function Main() {
  const [showDialogEliminazione, setShowDialogEliminazione] = useState<{ show: boolean; idPromo: string; stato?: string; isDeletable?: boolean; numero_kit_collegati?: number }>();
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
  type SortField = 'nome' | 'data_scadenza' | 'validita_dal' | 'validita_al' | 'stato' | 'offset_visibilita';
  type SortDirection = 'asc' | 'desc';
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
        if (stato === "IN_LAVORAZIONE") {
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
        }
        if (stato === "ELIMINATA") {
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
    onError(error: CustomError) {
      console.log(error);
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
              <div className="text-sm text-slate-500">Si è verificato un errore. Riprova o contatta il supporto.</div>
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

  // Calcola il numero totale di pagine
  const totalPages = Math.ceil(filteredData.length / pageSize);

  // Reset alla prima pagina quando cambia il filtro
  const onFilter = () => {
    setCurrentPage(1);
  };

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

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <div
      className="flex items-center gap-2 cursor-pointer hover:text-slate-900 select-none group"
      onClick={() => handleSort(field)}
    >
      {children}
      <div className="flex flex-col">
        <Lucide
          icon="ChevronUp"
          className={`w-3 h-3 -mb-1 transition-colors ${
            sortField === field && sortDirection === 'asc' ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600'
          }`}
        />
        <Lucide
          icon="ChevronDown"
          className={`w-3 h-3 -mt-1 transition-colors ${
            sortField === field && sortDirection === 'desc' ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600'
          }`}
        />
      </div>
    </div>
  );

  // Funzioni per l'export
  const onExportCsv = () => {
    const csvData = filteredData.map((promo) => ({
      "Nome Lavorazione": promo.nome,
      "Data di scadenza": dayjs(promo.data_scadenza).format("DD/MM/YYYY"),
      "Valida dal": dayjs(promo.validita_dal).format("DD/MM/YYYY"),
      "Valida al": dayjs(promo.validita_al).format("DD/MM/YYYY"),
      "Stato": promo.stato.replace("_", " ").toLocaleLowerCase().at(0)?.toLocaleUpperCase(),
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

  const onExportXlsx = () => {
    const wsData = filteredData.map((promo) => ({
      "Nome Lavorazione": promo.nome,
      "Data di scadenza": dayjs(promo.data_scadenza).format("DD/MM/YYYY"),
      "Valida dal": dayjs(promo.validita_dal).format("DD/MM/YYYY"),
      "Valida al": dayjs(promo.validita_al).format("DD/MM/YYYY"),
      "Stato": promo.stato.replace("_", " ").toLocaleLowerCase().at(0)?.toLocaleUpperCase(),
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
                  <td>${dayjs(promo.data_scadenza).format("DD/MM/YYYY")}</td>
                  <td>${dayjs(promo.validita_dal).format("DD/MM/YYYY")}</td>
                  <td>${dayjs(promo.validita_al).format("DD/MM/YYYY")}</td>
                  <td>${promo.stato.replace("_", " ").toLocaleLowerCase().at(0)?.toLocaleUpperCase()}</td>
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
                  <td>${dayjs(promo.data_scadenza).format("DD/MM/YYYY")}</td>
                  <td>${dayjs(promo.validita_dal).format("DD/MM/YYYY")}</td>
                  <td>${dayjs(promo.validita_al).format("DD/MM/YYYY")}</td>
                  <td>${promo.stato.replace("_", " ").toLocaleLowerCase().at(0)?.toLocaleUpperCase()}</td>
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

  const statoBadgeBaseClass =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 dark:bg-darkmode-700 border border-slate-200 dark:border-darkmode-400";
  const statoBadgeLabelClass =
    "text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap";

  const statoBadgeConfig: Record<
    STATO_PROMO,
    { label: string; dotClass: string }
  > = {
    [STATO_PROMO.PIANIFICATA]: { label: "Pianificata", dotClass: "bg-slate-400" },
    [STATO_PROMO.IN_LAVORAZIONE]: { label: "In lavorazione", dotClass: "bg-warning" },
    [STATO_PROMO.IN_SCADENZA]: { label: "In scadenza", dotClass: "bg-amber-500" },
    [STATO_PROMO.IN_ATTESA_DI_VALIDITA]: { label: "In attesa di validità", dotClass: "bg-sky-500" },
    [STATO_PROMO.IN_RITARDO]: { label: "In ritardo", dotClass: "bg-danger" },
    [STATO_PROMO.VALIDA]: { label: "Valida", dotClass: "bg-success" },
    [STATO_PROMO.VALIDA_CON_ERRORI]: { label: "Valida con errori", dotClass: "bg-lime-500" },
    [STATO_PROMO.ARCHIVIATA]: { label: "Archiviata", dotClass: "bg-slate-500" },
    [STATO_PROMO.ELIMINATA]: { label: "Eliminata", dotClass: "bg-danger" },
  };

  const renderStatoBadge = (stato: STATO_PROMO | string) => {
    const config =
      statoBadgeConfig[stato as STATO_PROMO] ??
      statoBadgeConfig[STATO_PROMO.IN_LAVORAZIONE];

    return (
      <div className={statoBadgeBaseClass}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        <span className={statoBadgeLabelClass}>{config.label}</span>
      </div>
    );
  };

  return (
    <>
      <Dialog open={showDialogEliminazione?.show} onClose={() => setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 })}>
        {(() => {
          if (showDialogEliminazione?.stato !== STATO_PROMO.ELIMINATA) {
            return (
              <Dialog.Panel>
                <Dialog.Title>
                  <div className="flex items-center gap-3">
                    <Lucide icon="CircleX" className="w-6 h-6 text-danger" />
                    <h2 className="mr-auto text-base font-medium">
                      {showDialogEliminazione?.isDeletable ? 'Eliminazione Definitiva' : 'Elimina Lavorazione'}
                    </h2>
                  </div>
                </Dialog.Title>
                <Dialog.Description>
                  <div className="text-center py-4">
                    <Lucide icon="TriangleAlert" className="w-16 h-16 mx-auto text-danger mb-4" />
                    <p className="text-slate-600">
                      {showDialogEliminazione?.isDeletable ? (
                        <>
                          <span className="font-semibold text-danger">ATTENZIONE:</span> Stai per eliminare definitivamente questa lavorazione. <br />
                          <span className="font-semibold text-danger">Questa azione non può essere annullata.</span>
                          {showDialogEliminazione?.numero_kit_collegati !== undefined && showDialogEliminazione.numero_kit_collegati > 0 && (
                            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Lucide icon="CircleAlert" className="w-4 h-4 text-danger" />
                                <span className="font-medium text-danger">
                                  {showDialogEliminazione.numero_kit_collegati} kit collegati
                                </span>
                              </div>
                              <p className="text-sm text-danger mt-1">
                                <span className="font-semibold">IMPORTANTE:</span> Questa lavorazione ha {showDialogEliminazione.numero_kit_collegati} kit associati che verranno eliminati definitivamente insieme alla lavorazione.
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          Sei sicuro di voler eliminare questa lavorazione? <br />
                          <span className="text-slate-500">La lavorazione verrà spostata nella sezione "Eliminate" e potrà essere ripristinata.</span>
                          {showDialogEliminazione?.numero_kit_collegati && showDialogEliminazione.numero_kit_collegati > 0 && (
                            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Lucide icon="Package" className="w-4 h-4 text-amber-600" />
                                <span className="font-medium text-amber-800">
                                  {showDialogEliminazione.numero_kit_collegati} kit collegati
                                </span>
                              </div>
                              <p className="text-sm text-amber-700 mt-1">
                                Questa lavorazione ha {showDialogEliminazione.numero_kit_collegati} kit associati che potrebbero essere influenzati dall'eliminazione.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </Dialog.Description>
                <Dialog.Footer className="px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400">
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 })}
                    className="w-24 mr-1"
                  >
                    Annulla
                  </Button>

                  <Button
                    type="button"
                    variant="danger"
                    className="w-30"
                    onClick={() => {
                      setLoadingEliminazione(true);
                      if (showDialogEliminazione) {
                        deleteLavorazione.mutate({
                          id: showDialogEliminazione.idPromo,
                          stato: showDialogEliminazione.stato as string,
                          isDeletable: showDialogEliminazione.isDeletable
                        });
                      }
                    }}
                    disabled={loadingEliminazione}
                  >
                    {loadingEliminazione ? (
                      <>
                        <Lucide icon="Loader" className="w-4 h-4 animate-spin mr-2" />
                        {showDialogEliminazione?.isDeletable ? 'Eliminando...' : 'Eliminando...'}
                      </>
                    ) : (
                      showDialogEliminazione?.isDeletable ? 'Elimina Definitivamente' : 'Elimina'
                    )}
                  </Button>

                </Dialog.Footer>
              </Dialog.Panel>
            );
          } else if (showDialogEliminazione?.stato === STATO_PROMO.ELIMINATA) {
            return (
              <Dialog.Panel>
                <Dialog.Title>
                  <div className="flex items-center gap-3">
                    <Lucide icon="TriangleAlert" className="w-6 h-6 text-warning" />
                    <h2 className="mr-auto text-base font-medium">
                      Ripristina Lavorazione
                    </h2>
                  </div>
                </Dialog.Title>
                <Dialog.Description>
                  <div className="text-center py-4">
                    <Lucide icon="TriangleAlert" className="w-16 h-16 mx-auto text-warning mb-4" />
                    <p className="text-slate-600">
                      Questa lavorazione è attualmente eliminata. <br />
                      Vuoi ripristinarla e riportarla in lavorazione?
                    </p>
                  </div>
                </Dialog.Description>
                <Dialog.Footer className="px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400">
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => setShowDialogEliminazione({ show: false, idPromo: "", numero_kit_collegati: 0 })}
                    className="w-24 mr-1"
                  >
                    Annulla
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    className="w-24"
                    onClick={() => {
                      setLoadingEliminazione(true);
                      if (showDialogEliminazione) {
                        deleteLavorazione.mutate({
                          id: showDialogEliminazione.idPromo,
                          stato: showDialogEliminazione.stato as string,
                          isDeletable: showDialogEliminazione.isDeletable
                        });
                      }
                    }}
                    disabled={loadingEliminazione}
                  >
                    {loadingEliminazione ? (
                      <>
                        <Lucide icon="Loader" className="w-4 h-4 animate-spin mr-2" />
                        Ripristinando...
                      </>
                    ) : (
                      "Ripristina"
                    )}
                  </Button>
                </Dialog.Footer>
              </Dialog.Panel>
            );
          }
        })() as React.ReactNode}
      </Dialog>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <PageHeader
            title="Promozioni in corso"
            description="Gestione lavorazioni in corso"
          />
          <div className="flex flex-col gap-8 mt-3.5">
            <div className="flex flex-col box box--stacked">
              <div className="flex flex-col p-5 xl:items-center xl:flex-row gap-y-2">
                <form
                  id="tabulator-html-filter-form"
                  className="flex xl:flex-row flex-col border-dashed gap-x-5 gap-y-2 border border-slate-300/80 xl:border-0 rounded-[0.6rem] p-4 sm:p-5 xl:p-0"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onFilter();
                  }}
                >
                  <FormInline className="flex-col items-start xl:flex-row xl:items-center gap-y-2">
                    <FormLabel className="mr-3 whitespace-nowrap flex items-center gap-2">
                      <Lucide icon="Search" className="w-4 h-4 text-primary" />
                      Cerca per
                    </FormLabel>
                    <FormSelect
                      id="tabulator-html-filter-field"
                      value={filter.field}
                      onChange={(e) => {
                        setFilter({ ...filter, field: e.target.value });
                      }}
                    >
                      <option value="nome">Nome Promo</option>
                      <option value="data_scadenza">Data di scadenza</option>
                      <option value="validita_dal">Valida Dal</option>
                      <option value="validita_al">Valida Al</option>
                      <option value="stato">Stato</option>
                      <option value="offset_visibilita">Offset visibilità</option>
                    </FormSelect>
                  </FormInline>
                  <FormInline className="flex-col items-start xl:flex-row xl:items-center gap-y-2">
                    <FormLabel className="mr-3 whitespace-nowrap flex items-center gap-2">
                      <Lucide icon="Filter" className="w-4 h-4 text-primary" />
                      Parola chiave
                    </FormLabel>
                    <FormInput
                      id="tabulator-html-filter-value"
                      value={filter.value}
                      onChange={(e) => {
                        setFilter({ ...filter, value: e.target.value });
                      }}
                      type="text"
                      placeholder="Cerca..."
                    />
                  </FormInline>
                  <div className="flex flex-col gap-2 mt-2 sm:flex-row xl:mt-0">
                    <Button
                      id="tabulator-html-filter-go"
                      variant="outline-primary"
                      type="submit"
                      className="w-full sm:w-auto bg-primary/5 border-primary/20"
                    >
                      <Lucide icon="Search" className="w-4 h-4 mr-2" />
                      Cerca
                    </Button>
                    <Button
                      id="tabulator-html-filter-reset"
                      variant="outline-secondary"
                      type="button"
                      className="w-full sm:w-auto bg-slate-50/50"
                      onClick={onResetFilter}
                    >
                      <Lucide icon="RotateCcw" className="w-4 h-4 mr-2" />
                      Resetta
                    </Button>
                  </div>
                </form>
                <div className="flex flex-col mt-3 sm:flex-row gap-x-3 gap-y-2 xl:ml-auto xl:mt-0">
                  <Button variant="outline-secondary" onClick={onPrint}>
                    <Lucide icon="Printer" className="stroke-[1.3] w-4 h-4 mr-2" />
                    Stampa
                  </Button>
                  <Menu className="sm:ml-auto xl:ml-0">
                    <Menu.Button as={Button} variant="outline-secondary" className="w-full sm:w-auto">
                      <Lucide icon="Download" className="stroke-[1.3] w-4 h-4 mr-2" />
                      Esporta
                      <Lucide icon="ChevronDown" className="stroke-[1.3] w-4 h-4 ml-2" />
                    </Menu.Button>
                    <Menu.Items className="w-40">
                      <Menu.Item onClick={onExportCsv}>
                        <Lucide icon="FileText" className="w-4 h-4 mr-2" /> Export CSV
                      </Menu.Item>
                      <Menu.Item onClick={onExportJson}>
                        <Lucide icon="FileCode" className="w-4 h-4 mr-2" /> Export JSON
                      </Menu.Item>
                      <Menu.Item onClick={onExportXlsx}>
                        <Lucide icon="FileSpreadsheet" className="w-4 h-4 mr-2" /> Export XLSX
                      </Menu.Item>
                      <Menu.Item onClick={onExportHtml}>
                        <Lucide icon="Globe" className="w-4 h-4 mr-2" /> Export HTML
                      </Menu.Item>
                    </Menu.Items>
                  </Menu>
                </div>
              </div>
              <div className="overflow-x-auto">
                {data.isLoading ? (
                  <div className="flex flex-col items-center justify-center py-10 px-5">
                    <Lucide icon="Loader" className="w-10 h-10 text-primary animate-spin" />
                    <div className="mt-3 text-slate-500">Caricamento in corso...</div>
                  </div>
                ) : filteredData.length === 0 ? (
                  <EmptyState
                    icon="CircleAlert"
                    title="Nessuna lavorazione in corso"
                    description="Non ci sono lavorazioni in corso che corrispondono ai filtri selezionati."
                  />
                ) : (
                  <>
                    <div className="border-t border-slate-200 dark:border-darkmode-400 hidden xl:block">
                      <Table>
                        <Table.Thead variant="light">
                          <Table.Tr>
                            <Table.Th className="whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">
                              <SortableHeader field="nome">
                                <Lucide icon="FileText" className="w-4 h-4" />
                                Nome Lavorazione
                              </SortableHeader>
                            </Table.Th>
                            <Table.Th className="whitespace-nowrap text-center font-semibold text-slate-700 dark:text-slate-200">
                              <SortableHeader field="data_scadenza">
                                <Lucide icon="CalendarClock" className="w-4 h-4" />
                                Scadenza
                              </SortableHeader>
                            </Table.Th>
                            <Table.Th className="whitespace-nowrap text-center font-semibold text-slate-700 dark:text-slate-200">
                              <SortableHeader field="validita_dal">
                                <Lucide icon="CalendarCheck" className="w-4 h-4" />
                                Valida dal
                              </SortableHeader>
                            </Table.Th>
                            <Table.Th className="whitespace-nowrap text-center font-semibold text-slate-700 dark:text-slate-200">
                              <SortableHeader field="validita_al">
                                <Lucide icon="CalendarX" className="w-4 h-4" />
                                Valida al
                              </SortableHeader>
                            </Table.Th>
                            <Table.Th className="whitespace-nowrap text-center font-semibold text-slate-700 dark:text-slate-200">
                              <SortableHeader field="stato">
                                <Lucide icon="Activity" className="w-4 h-4" />
                                Stato
                              </SortableHeader>
                            </Table.Th>
                            <Table.Th className="whitespace-nowrap text-center font-semibold text-slate-700 dark:text-slate-200">
                              <SortableHeader field="offset_visibilita">
                                <Lucide icon="Eye" className="w-4 h-4" />
                                Visibilità
                              </SortableHeader>
                            </Table.Th>
                            <Table.Th className="whitespace-nowrap text-center font-semibold text-slate-700 dark:text-slate-200">
                              <div className="flex items-center justify-center gap-2">
                                <Lucide icon="Settings" className="w-4 h-4" />
                                Azioni
                              </div>
                            </Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {paginatedData.map((promo) => (
                            <Table.Tr key={promo.id}>
                              <Table.Td className="min-w-[200px]">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex items-center justify-center w-8 h-8 rounded bg-slate-100 dark:bg-darkmode-700">
                                    <Lucide icon="FileText" className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                                      {promo.nome}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                      ID: {promo.id.slice(0, 8)}
                                    </div>
                                  </div>
                                </div>
                              </Table.Td>
                              <Table.Td>
                                <div className="flex items-center justify-center gap-2">
                                  <Lucide icon="Calendar" className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {dayjs(promo.data_scadenza).format("DD/MM/YYYY")}
                                  </div>
                                </div>
                              </Table.Td>
                              <Table.Td>
                                <div className="flex items-center justify-center gap-2">
                                  <Lucide icon="Calendar" className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {dayjs(promo.validita_dal).format("DD/MM/YYYY")}
                                  </div>
                                </div>
                              </Table.Td>
                              <Table.Td>
                                <div className="flex items-center justify-center gap-2">
                                  <Lucide icon="Calendar" className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {dayjs(promo.validita_al).format("DD/MM/YYYY")}
                                  </div>
                                </div>
                              </Table.Td>
                              <Table.Td>
                                <div className="flex justify-center">
                                  {renderStatoBadge(promo.stato)}
                                </div>
                              </Table.Td>
                              <Table.Td>
                                <div className="flex items-center justify-center gap-1.5">
                                  <Lucide icon="Eye" className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                  <span className="text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {promo.offset_visibilita} giorni
                                  </span>
                                </div>
                              </Table.Td>
                              <Table.Td>
                                {promo.stato !== "ELIMINATA" ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <PermissionGate permission="promo.visualizza">
                                      <Button
                                        variant="outline-primary"
                                        size="sm"
                                        className="shadow-sm hover:shadow-md transition-shadow"
                                        onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                                      >
                                        <Lucide icon="Eye" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                        Visualizza
                                      </Button>
                                    </PermissionGate>
                                    <PermissionGate permission="promo.elimina">
                                      <Button
                                        variant="outline-danger"
                                        size="sm"
                                        className="shadow-sm hover:shadow-md transition-shadow"
                                        onClick={() =>
                                          setShowDialogEliminazione({
                                            show: true,
                                            idPromo: promo.id,
                                            stato: promo.stato,
                                            isDeletable: promo.is_deletable,
                                            numero_kit_collegati: promo.numero_kit_collegati
                                          })
                                        }
                                      >
                                        <Lucide icon="Trash2" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                        Elimina
                                      </Button>
                                    </PermissionGate>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="outline-secondary"
                                      size="sm"
                                      className="shadow-sm hover:shadow-md transition-shadow"
                                      onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                                    >
                                      <Lucide icon="FileText" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                      Dettagli
                                    </Button>
                                    <Button
                                      variant="outline-primary"
                                      size="sm"
                                      className="shadow-sm hover:shadow-md transition-shadow"
                                      onClick={() =>
                                        setShowDialogEliminazione({
                                          show: true,
                                          idPromo: promo.id,
                                          stato: promo.stato,
                                          isDeletable: promo.is_deletable,
                                          numero_kit_collegati: promo.numero_kit_collegati
                                        })
                                      }
                                    >
                                      <Lucide icon="Undo" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                      Ripristina
                                    </Button>
                                  </div>
                                )}
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="xl:hidden border-t border-slate-200 dark:border-darkmode-400">
                      {paginatedData.map((promo) => (
                        <div
                          key={promo.id}
                          className="p-4 border-b border-slate-200 dark:border-darkmode-400 hover:bg-slate-50 dark:hover:bg-darkmode-700/50 transition-colors"
                        >
                          {/* Header with icon and name */}
                          <div className="flex items-start gap-2.5 mb-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded bg-slate-100 dark:bg-darkmode-700 flex-shrink-0">
                              <Lucide icon="FileText" className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 dark:text-slate-100 text-sm break-words">
                                {promo.nome}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                ID: {promo.id.slice(0, 8)}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              {renderStatoBadge(promo.stato)}
                            </div>
                          </div>

                          {/* Info Grid */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Lucide icon="Calendar" className="w-3.5 h-3.5" />
                                <span>Scadenza</span>
                              </div>
                              <div className="text-sm text-slate-700 dark:text-slate-300">
                                {dayjs(promo.data_scadenza).format("DD/MM/YYYY")}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Lucide icon="Eye" className="w-3.5 h-3.5" />
                                <span>Visibilità</span>
                              </div>
                              <div className="text-sm text-slate-700 dark:text-slate-300">
                                {promo.offset_visibilita} giorni
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Lucide icon="Calendar" className="w-3.5 h-3.5" />
                                <span>Valida dal</span>
                              </div>
                              <div className="text-sm text-slate-700 dark:text-slate-300">
                                {dayjs(promo.validita_dal).format("DD/MM/YYYY")}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <Lucide icon="Calendar" className="w-3.5 h-3.5" />
                                <span>Valida al</span>
                              </div>
                              <div className="text-sm text-slate-700 dark:text-slate-300">
                                {dayjs(promo.validita_al).format("DD/MM/YYYY")}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-slate-100 dark:border-darkmode-600">
                            {promo.stato !== "ELIMINATA" ? (
                              <>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  className="flex-1 shadow-sm"
                                  onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                                >
                                  <Lucide icon="Eye" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                  Visualizza
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  className="flex-1 shadow-sm"
                                  onClick={() =>
                                    setShowDialogEliminazione({
                                      show: true,
                                      idPromo: promo.id,
                                      stato: promo.stato,
                                      isDeletable: promo.is_deletable,
                                      numero_kit_collegati: promo.numero_kit_collegati
                                    })
                                  }
                                >
                                  <Lucide icon="Trash2" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                  Elimina
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="outline-secondary"
                                  size="sm"
                                  className="flex-1 shadow-sm"
                                  onClick={() => navigate(`/promozioni/in-corso/dettagli/${promo.id}`)}
                                >
                                  <Lucide icon="FileText" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                  Dettagli
                                </Button>
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  className="flex-1 shadow-sm"
                                  onClick={() =>
                                    setShowDialogEliminazione({
                                      show: true,
                                      idPromo: promo.id,
                                      stato: promo.stato,
                                      isDeletable: promo.is_deletable,
                                      numero_kit_collegati: promo.numero_kit_collegati
                                    })
                                  }
                                >
                                  <Lucide icon="Undo" className="w-3.5 h-3.5 stroke-[1.7] mr-1.5" />
                                  Ripristina
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination controls */}
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-4 px-5 py-4 bg-slate-50/30 dark:bg-darkmode-800/20 border-t border-slate-200 dark:border-darkmode-400">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400">Righe per pagina:</span>
                        <FormSelect
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="w-16 text-xs"
                        >
                          <option value="10">10</option>
                          <option value="20">20</option>
                          <option value="30">30</option>
                          <option value="40">40</option>
                        </FormSelect>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span>
                          Pagina {currentPage} di {totalPages}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span>
                          {filteredData.length} {filteredData.length === 1 ? 'risultato' : 'risultati'}
                        </span>
                      </div>

                      <Pagination>
                        <Pagination.Link
                          onClick={() => setCurrentPage(1)}
                          active={false}
                        >
                          <Lucide icon="ChevronsLeft" className="w-4 h-4" />
                        </Pagination.Link>
                        <Pagination.Link
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          active={false}
                        >
                          <Lucide icon="ChevronLeft" className="w-4 h-4" />
                        </Pagination.Link>

                        {/* Page numbers */}
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number = 1;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }

                          return (
                            <Pagination.Link
                              key={pageNum}
                              active={currentPage === pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Pagination.Link>
                          );
                        })}

                        <Pagination.Link
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          active={false}
                        >
                          <Lucide icon="ChevronRight" className="w-4 h-4" />
                        </Pagination.Link>
                        <Pagination.Link
                          onClick={() => setCurrentPage(totalPages)}
                          active={false}
                        >
                          <Lucide icon="ChevronsRight" className="w-4 h-4" />
                        </Pagination.Link>
                      </Pagination>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default withSessionCheck(Main);
