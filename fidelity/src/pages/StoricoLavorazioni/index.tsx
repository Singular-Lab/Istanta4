import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import { Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import withSessionCheck from "@/components/SessionChecker";
import { descriviStato } from "@/constants/stati";
import { useFetchStoricoLavorazioni } from "@/query/query";
import { formatData } from "@/utils/format";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as xlsx from "xlsx";
import { PromoResponseDTO } from "../../../server/core/dto";
import EmptyState from "../../components/EmptyState";
import IntestazioneOrdinabile, { ARIA_SORT, type DirezioneOrdinamento } from "../shared/IntestazioneOrdinabile";

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

  const data = useFetchStoricoLavorazioni();

  // Filtra e ordina i dati
  const filteredData = useMemo<PromoResponseDTO[]>(() => {
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
    a.download = "storico_lavorazioni.csv";
    a.click();
  };

  const onExportJson = () => {
    const json = JSON.stringify(filteredData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "storico_lavorazioni.json";
    a.click();
  };

  const onExportXlsx = () => {
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
    xlsx.utils.book_append_sheet(wb, ws, "StoricoLavorazioni");
    xlsx.writeFile(wb, "storico_lavorazioni.xlsx");
  };

  const onExportHtml = () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Storico Lavorazioni</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>Storico Lavorazioni</h1>
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
    a.download = "storico_lavorazioni.html";
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
          <title>Storico Lavorazioni</title>
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
          <h1>Storico Lavorazioni</h1>
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

  const filtroAttivo = filter.value !== "";

  return (
    <Pagina titolo="Storico promozioni" descrizione="Visualizza lo storico delle lavorazioni completate, eliminate o scadute">
      <Sezione senzaPadding aria-label="Storico delle promozioni">
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
          <CampoRicerca etichetta="Cerca nello storico" value={filter.value} onChange={(valore) => cambiaFiltro({ value: valore })} />
        </BarraFiltri>

        {data.isLoading ? (
          <div className="flex justify-center px-5 py-12">
            <Spinner size="lg" etichetta="Caricamento dello storico" />
          </div>
        ) : data.isError ? (
          <PageError
            compatta
            className="m-5"
            titolo="Storico non caricato"
            motivo={data.error?.message || "Impossibile caricare lo storico delle lavorazioni."}
            onRiprova={() => data.refetch()}
          />
        ) : filteredData.length === 0 ? (
          filtroAttivo ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Nessun risultato"
              description="Nessuna lavorazione dello storico corrisponde alla ricerca."
              buttonText="Azzera ricerca"
              buttonIcon="RotateCcw"
              onButtonClick={onResetFilter}
            />
          ) : (
            <EmptyState compatta icon="Archive" title="Nessuna lavorazione" description="Non ci sono lavorazioni nello storico." />
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
                      <Table.Td className="text-right">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => navigate(`/promozioni/storico/dettagli/${promo.id}`)}
                        >
                          Visualizza
                          <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
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
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/promozioni/storico/dettagli/${promo.id}`)}
                  >
                    Visualizza
                    <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
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
  );
}

export default withSessionCheck(Main);
