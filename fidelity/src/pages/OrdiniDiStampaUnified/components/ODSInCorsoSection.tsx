import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import dayjs from "dayjs";
import React, { useMemo, useState } from "react";
import { STATO_ORDINI_STAMPA } from "../../../../lib/enums";
import { OrdiniDiStampaResponseDTO } from "../../../../server/core/dto";

interface ODSInCorsoSectionProps {
  ordini: (OrdiniDiStampaResponseDTO & { nomePromo: string })[];
  searchQuery: string;
  onRevisioneClick: (ordineId: string) => void;
}

type SortField = 'data' | 'promozione' | 'anzianita' | 'stato';
type SortDirection = 'asc' | 'desc';

const ODSInCorsoSection: React.FC<ODSInCorsoSectionProps> = ({ ordini, searchQuery, onRevisioneClick }) => {
  const [sortField, setSortField] = useState<SortField>('anzianita');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statoFilter, setStatoFilter] = useState<string>('all');

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
    const overdue = ordiniWithMetrics.filter(o => o.daysInWaiting > 30).length;
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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case STATO_ORDINI_STAMPA.FINITO:
        return 'text-success bg-success/10 border-success/20';
      case STATO_ORDINI_STAMPA.IN_REVISIONE:
        return 'text-pending bg-pending/10 border-pending/20';
      case 'annullato':
        return 'text-danger bg-danger/10 border-danger/20';
      case STATO_ORDINI_STAMPA.REVISIONATO:
        return 'text-warning bg-warning/10 border-warning/20';
      default:
        return 'text-info bg-info/10 border-info/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case STATO_ORDINI_STAMPA.IN_REVISIONE:
        return 'In Revisione';
      case STATO_ORDINI_STAMPA.FINITO:
        return 'Completato';
      case STATO_ORDINI_STAMPA.REVISIONATO:
        return 'Revisionato';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case STATO_ORDINI_STAMPA.FINITO:
        return 'CircleCheck';
      case STATO_ORDINI_STAMPA.IN_REVISIONE:
        return 'Clock';
      case STATO_ORDINI_STAMPA.REVISIONATO:
        return 'Eye';
      default:
        return 'Circle';
    }
  };

  const getUrgencyBadge = (daysInWaiting: number) => {
    if (daysInWaiting > 180) {
      return { text: `Da ${Math.floor(daysInWaiting / 30)} mesi`, icon: 'TriangleAlert' };
    } else if (daysInWaiting > 60) {
      return { text: `Da ${daysInWaiting} giorni`, icon: 'Clock' };
    } else if (daysInWaiting > 30) {
      return { text: `Da ${daysInWaiting} giorni`, icon: 'Clock' };
    }
    return null;
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

  return (
    <div>
      <div className="flex flex-col box box--stacked shadow-sm">
        {/* KPI Dashboard Header */}
        <div className="p-6 border-b border-slate-200/60 bg-slate-50/30">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-1">Ordini in corso</h3>
              <p className="text-sm text-slate-600">Monitoraggio ordini di stampa in lavorazione</p>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Orders */}
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                <Lucide icon="Layers" className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase">Totale</p>
                <p className="text-2xl font-bold text-slate-900">{kpis.total}</p>
              </div>
            </div>

            {/* Overdue Orders */}
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                <Lucide icon="TriangleAlert" className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase">In Ritardo</p>
                <p className="text-2xl font-bold text-slate-900">{kpis.overdue}</p>
              </div>
            </div>

            {/* Average Waiting Time */}
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                <Lucide icon="Clock" className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase">Media Attesa</p>
                <p className="text-2xl font-bold text-slate-900">{kpis.avgWaitingTime}<span className="text-sm text-slate-600 ml-1">gg</span></p>
              </div>
            </div>

            {/* Longest Waiting */}
            <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-slate-200">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100">
                <Lucide icon="Timer" className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-600 uppercase">Max Attesa</p>
                <p className="text-2xl font-bold text-slate-900">{kpis.longestWaiting}<span className="text-sm text-slate-600 ml-1">gg</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* State Filters */}
        {availableStates.length > 1 && (
          <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/30">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-700 mr-2">Filtra per stato:</span>
              <button
                onClick={() => setStatoFilter('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  statoFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                Tutti ({kpis.total})
              </button>
              {availableStates.map(stato => {
                const count = ordiniWithMetrics.filter(o => o.stato === stato).length;
                return (
                  <button
                    key={stato}
                    onClick={() => setStatoFilter(stato)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      statoFilter === stato
                        ? 'bg-slate-800 text-white'
                        : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {getStatusLabel(stato)} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-auto xl:overflow-visible">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Td className="py-4 font-medium border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <SortableHeader field="promozione">
                    <Lucide icon="Tag" className="w-4 h-4" />
                    Promozione
                  </SortableHeader>
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <SortableHeader field="stato">
                    <Lucide icon="Activity" className="w-4 h-4" />
                    Stato
                  </SortableHeader>
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <SortableHeader field="data">
                    <Lucide icon="Calendar" className="w-4 h-4" />
                    Data Conferma
                  </SortableHeader>
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <SortableHeader field="anzianita">
                    <Lucide icon="Timer" className="w-4 h-4" />
                    Giorni Attesa
                  </SortableHeader>
                </Table.Td>
                <Table.Td className="py-4 font-medium text-center border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  Azioni
                </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredOrdini && filteredOrdini.length > 0 ? (
                filteredOrdini.map((ordine, index) => {
                  const urgencyBadge = getUrgencyBadge(ordine.daysInWaiting);
                  const isUrgent = ordine.daysInWaiting > 60;

                  return (
                    <Table.Tr
                      key={ordine.id}
                      className={`[&_td]:last:border-b-0 hover:bg-slate-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      <Table.Td className="py-3.5 border-dashed dark:bg-darkmode-600">
                        <div className="font-medium text-slate-800">{ordine.nomePromo}</div>
                      </Table.Td>
                      <Table.Td className="py-3.5 border-dashed dark:bg-darkmode-600">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${getStatusColor(ordine.stato)}`}>
                          <Lucide icon={getStatusIcon(ordine.stato)} className="w-3.5 h-3.5" />
                          {getStatusLabel(ordine.stato)}
                        </div>
                      </Table.Td>
                      <Table.Td className="py-3.5 border-dashed dark:bg-darkmode-600">
                        {ordine.data_di_conferma ? (
                          <div className="text-sm text-slate-700">
                            {dayjs(ordine.data_di_conferma).format("DD/MM/YYYY")}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500 italic">In attesa</span>
                        )}
                      </Table.Td>
                      <Table.Td className="py-3.5 border-dashed dark:bg-darkmode-600">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-slate-900">{ordine.daysInWaiting}</span>
                          <span className="text-sm text-slate-600">giorni</span>
                          {urgencyBadge && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-slate-700 bg-slate-100 rounded border border-slate-300">
                              <Lucide icon={urgencyBadge.icon as any} className="w-3 h-3" />
                              {urgencyBadge.text}
                            </div>
                          )}
                        </div>
                      </Table.Td>
                      <Table.Td className="py-3.5 border-dashed relative text-center dark:bg-darkmode-600">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => onRevisioneClick(ordine.id)}
                        >
                          <Lucide icon="Eye" className="w-4 h-4 mr-2" />
                          Revisiona
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} className="py-16 text-center bg-slate-50/30">
                    <EmptyState
                      icon={searchQuery || statoFilter !== 'all' ? "Search" : "Truck"}
                      title={searchQuery || statoFilter !== 'all' ? "Nessun risultato trovato" : "Nessun ordine in corso"}
                      description={
                        searchQuery
                          ? `Nessun ordine trovato per "${searchQuery}"`
                          : statoFilter !== 'all'
                          ? `Nessun ordine con stato "${getStatusLabel(statoFilter)}"`
                          : "Gli ordini di stampa appariranno qui una volta avviati."
                      }
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default ODSInCorsoSection;
