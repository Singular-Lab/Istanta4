import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Lucide from "@/components/Base/Lucide";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Segmenti, { type OpzioneSegmento } from "@/components/Base/Segmenti";
import Sezione from "@/components/Base/Sezione";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { descriviStato } from "@/constants/stati";
import { formatData } from "@/utils/format";
import dayjs from "dayjs";
import React, { useEffect, useMemo, useState } from "react";
import { OrdiniDiStampaResponseDTO } from "../../../../server/core/dto";

interface ODSInCorsoSectionProps {
  ordini: (OrdiniDiStampaResponseDTO & { nomePromo: string })[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onRevisioneClick: (ordineId: string) => void;
}

type SortField = 'data' | 'promozione' | 'anzianita' | 'stato';
type SortDirection = 'asc' | 'desc';

const COLONNE = 5;
// Oltre questa attesa l'ordine è in ritardo (KPI e badge di riga)
const GIORNI_RITARDO = 30;

const etichettaStato = (stato: string) => descriviStato("ordineStampa", stato).etichetta;

// aria-sort solo sulla colonna che ordina, come chiede ARIA
const ariaSort = (field: SortField, sortField: SortField, sortDirection: SortDirection): React.AriaAttributes['aria-sort'] =>
  sortField !== field ? undefined : sortDirection === 'asc' ? 'ascending' : 'descending';

interface SortableHeaderProps {
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  children: React.ReactNode;
}

// Fuori dal componente: ridefinito a ogni render, il pulsante perderebbe il focus dopo l'ordinamento
const SortableHeader = ({ field, sortField, sortDirection, onSort, children }: SortableHeaderProps) => {
  const attiva = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={`inline-flex select-none items-center gap-1 uppercase hover:text-slate-800 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 ${
        attiva ? 'text-slate-700' : ''
      }`}
    >
      {children}
      {attiva && (
        <Lucide icon={sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown'} aria-hidden="true" className="h-3 w-3" />
      )}
    </button>
  );
};

const ODSInCorsoSection: React.FC<ODSInCorsoSectionProps> = ({ ordini, searchQuery, onSearchQueryChange, onRevisioneClick }) => {
  const [sortField, setSortField] = useState<SortField>('anzianita');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statoFilter, setStatoFilter] = useState<string>('all');
  const [pagina, setPagina] = useState(1);
  const [righePerPagina, setRighePerPagina] = useState(25);

  // Calculate days in waiting for each order
  const ordiniWithMetrics = useMemo(() => {
    return ordini?.map(ordine => {
      const daysInWaiting = ordine.data_di_conferma
        ? dayjs().diff(dayjs(ordine.data_di_conferma), 'day')
        : 0;
      return { ...ordine, daysInWaiting };
    }) || [];
  }, [ordini]);

  // Calculate KPIs
  const kpis = useMemo(() => {
    const total = ordiniWithMetrics.length;
    const overdue = ordiniWithMetrics.filter(o => o.daysInWaiting > GIORNI_RITARDO).length;
    const avgWaitingTime = total > 0
      ? Math.round(ordiniWithMetrics.reduce((sum, o) => sum + o.daysInWaiting, 0) / total)
      : 0;
    const longestWaiting = total > 0
      ? Math.max(...ordiniWithMetrics.map(o => o.daysInWaiting))
      : 0;

    return { total, overdue, avgWaitingTime, longestWaiting };
  }, [ordiniWithMetrics]);

  // Get unique states
  const availableStates = useMemo(() => {
    const states = new Set(ordiniWithMetrics.map(o => o.stato));
    return Array.from(states);
  }, [ordiniWithMetrics]);

  const opzioniStato = useMemo<OpzioneSegmento<string>[]>(
    () => [
      { valore: 'all', etichetta: 'Tutti', conteggio: kpis.total },
      ...availableStates.map(stato => ({
        valore: stato,
        etichetta: etichettaStato(stato),
        conteggio: ordiniWithMetrics.filter(o => o.stato === stato).length,
      })),
    ],
    [availableStates, ordiniWithMetrics, kpis.total]
  );

  const filteredOrdini = useMemo(() => {
    let result = ordiniWithMetrics;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(ordine =>
        ordine.nomePromo?.toLowerCase().includes(query)
      );
    }

    // State filter
    if (statoFilter !== 'all') {
      result = result.filter(ordine => ordine.stato === statoFilter);
    }

    // Sorting
    result = [...result].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'data':
          comparison = dayjs(a.data_di_conferma || 0).diff(dayjs(b.data_di_conferma || 0));
          break;
        case 'promozione':
          comparison = (a.nomePromo || '').localeCompare(b.nomePromo || '');
          break;
        case 'anzianita':
          comparison = a.daysInWaiting - b.daysInWaiting;
          break;
        case 'stato':
          comparison = a.stato.localeCompare(b.stato);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [ordiniWithMetrics, searchQuery, statoFilter, sortField, sortDirection]);

  // Una nuova ricerca o un altro filtro ripartono dalla prima pagina
  useEffect(() => setPagina(1), [searchQuery, statoFilter]);

  const ordiniInPagina = filteredOrdini.slice((pagina - 1) * righePerPagina, pagina * righePerPagina);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const intestazione = (field: SortField, etichetta: string) => (
    <Table.Th aria-sort={ariaSort(field, sortField, sortDirection)}>
      <SortableHeader field={field} sortField={sortField} sortDirection={sortDirection} onSort={handleSort}>
        {etichetta}
      </SortableHeader>
    </Table.Th>
  );

  const filtriAttivi = Boolean(searchQuery) || statoFilter !== 'all';

  return (
    <>
      <StatCardGrid>
        <StatCard densita="compatta" etichetta="Ordini in corso" valore={kpis.total} icona="Layers" tono="brand" />
        <StatCard
          densita="compatta"
          etichetta="In ritardo"
          valore={kpis.overdue}
          icona="TriangleAlert"
          tono="danger"
          evidenzia={kpis.overdue > 0}
        />
        <StatCard densita="compatta" etichetta="Attesa media" valore={`${kpis.avgWaitingTime} gg`} icona="Clock" tono="neutral" />
        <StatCard densita="compatta" etichetta="Attesa massima" valore={`${kpis.longestWaiting} gg`} icona="Timer" tono="warning" />
      </StatCardGrid>

      <Sezione senzaPadding titolo="Ordini in corso" descrizione="Ordini di stampa in lavorazione, dal più vecchio">
        <BarraFiltri
          destra={
            availableStates.length > 1 && (
              <Segmenti etichetta="Stato" valore={statoFilter} onChange={setStatoFilter} opzioni={opzioniStato} />
            )
          }
        >
          <CampoRicerca
            etichetta="Cerca ordini"
            placeholder="Nome della promozione"
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
        </BarraFiltri>

        <div className="overflow-x-auto">
          <Table>
            <Table.Thead>
              <Table.Tr>
                {intestazione('promozione', 'Promozione')}
                {intestazione('stato', 'Stato')}
                {intestazione('data', 'Data conferma')}
                {intestazione('anzianita', 'Giorni di attesa')}
                <Table.Th className="text-right">
                  <span className="sr-only">Azioni</span>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ordiniInPagina.length > 0 ? (
                ordiniInPagina.map((ordine) => (
                  <Table.Tr key={ordine.id}>
                    <Table.Td className="font-medium text-slate-800">{ordine.nomePromo}</Table.Td>
                    <Table.Td>
                      <StatusBadge dominio="ordineStampa" stato={ordine.stato} />
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">
                      {ordine.data_di_conferma ? (
                        formatData(ordine.data_di_conferma)
                      ) : (
                        <span className="text-slate-400">In attesa</span>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-semibold tabular-nums text-slate-800">{ordine.daysInWaiting} gg</span>
                        {ordine.daysInWaiting > GIORNI_RITARDO && <StatusBadge tono="danger" etichetta="In ritardo" />}
                      </div>
                    </Table.Td>
                    <Table.Td className="text-right">
                      <Button type="button" variant="outline-secondary" size="sm" onClick={() => onRevisioneClick(ordine.id)}>
                        Revisiona
                        <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={COLONNE} className="p-0">
                    <EmptyState
                      compatta
                      icon={filtriAttivi ? "Search" : "Truck"}
                      title={filtriAttivi ? "Nessun risultato trovato" : "Nessun ordine in corso"}
                      description={
                        searchQuery
                          ? `Nessun ordine trovato per "${searchQuery}"`
                          : statoFilter !== 'all'
                          ? `Nessun ordine con stato "${etichettaStato(statoFilter)}"`
                          : "Gli ordini di stampa appariranno qui una volta avviati."
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>

        <PaginazioneTabella
          totale={filteredOrdini.length}
          pagina={pagina}
          dimensionePagina={righePerPagina}
          onCambiaPagina={setPagina}
          onCambiaDimensione={setRighePerPagina}
        />
      </Sezione>
    </>
  );
};

export default ODSInCorsoSection;
