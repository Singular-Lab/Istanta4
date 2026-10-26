import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import dayjs from "dayjs";
import React, { useMemo } from "react";
import { STATO_ORDINI_STAMPA } from "../../../../lib/enums";
import { OrdiniDiStampaResponseDTO } from "../../../../server/core/dto";

interface ODSCompletatiSectionProps {
  ordini: (OrdiniDiStampaResponseDTO & { nomePromo: string })[];
  searchQuery: string;
  onViewDetails: (ordineId: string) => void;
}

const ODSCompletatiSection: React.FC<ODSCompletatiSectionProps> = ({ ordini, searchQuery, onViewDetails }) => {
  const filteredOrdini = useMemo(() => {
    if (!searchQuery.trim()) return ordini;
    const query = searchQuery.toLowerCase();
    return ordini?.filter(ordine =>
      ordine.id.toLowerCase().includes(query) ||
      ordine.nomePromo?.toLowerCase().includes(query)
    );
  }, [ordini, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case STATO_ORDINI_STAMPA.FINITO:
        return 'text-success bg-success/10';
      case STATO_ORDINI_STAMPA.IN_REVISIONE:
        return 'text-pending bg-pending/10';
      case 'annullato':
        return 'text-danger bg-danger/10';
      case STATO_ORDINI_STAMPA.REVISIONATO:
        return 'text-warning bg-warning/10';
      default:
        return 'text-info bg-info/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case STATO_ORDINI_STAMPA.IN_REVISIONE:
        return 'In revisione';
      case STATO_ORDINI_STAMPA.FINITO:
        return 'Completato';
      case STATO_ORDINI_STAMPA.REVISIONATO:
        return 'Revisionato';
      default:
        return status;
    }
  };

  return (
    <div>
      <div className="flex flex-col box box--stacked shadow-sm">
        {/* Enhanced Header with gradient background */}
        <div className="relative flex items-center gap-x-3 p-6 border-b border-slate-200/60 bg-gradient-to-r from-success/5 to-success/10">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm">
            <Lucide icon="CircleCheck" className="w-6 h-6 text-success" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800">Ordini completati</h3>
            <p className="text-sm text-slate-600 mt-0.5">Ordini di stampa inviati alla tipografia</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white shadow-sm border border-success/20">
              <span className="text-success">{filteredOrdini?.length || 0}</span>
              <span className="text-slate-600 ml-1">completati</span>
            </div>
          </div>
        </div>

        <div className="overflow-auto xl:overflow-visible">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Td className="py-4 font-semibold border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Lucide icon="FileText" className="w-4 h-4" />
                    ID Ordine
                  </div>
                </Table.Td>
                <Table.Td className="py-4 font-semibold border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Lucide icon="Tag" className="w-4 h-4" />
                    Promozione
                  </div>
                </Table.Td>
                <Table.Td className="py-4 font-semibold border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Lucide icon="Activity" className="w-4 h-4" />
                    Stato
                  </div>
                </Table.Td>
                <Table.Td className="py-4 font-semibold border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Lucide icon="CalendarClock" className="w-4 h-4" />
                    Data Conferma
                  </div>
                </Table.Td>
                <Table.Td className="py-4 font-semibold text-center border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  Azioni
                </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredOrdini && filteredOrdini.length > 0 ? (
                filteredOrdini.map((ordine) => (
                  <Table.Tr key={ordine.id} className="[&_td]:last:border-b-0 hover:bg-slate-50/50 transition-colors">
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
                          <Lucide icon="CircleCheck" className="w-5 h-5 text-success" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">#{ordine.id.slice(0, 8)}</div>
                          <div className="text-xs text-slate-500 mt-0.5">ID Completo: {ordine.id.slice(0, 16)}...</div>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="font-medium text-slate-700">{ordine.nomePromo}</div>
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border border-success/20 ${getStatusColor(ordine.stato)}`}>
                        <Lucide icon="Check" className="w-4 h-4" />
                        {getStatusLabel(ordine.stato)}
                      </div>
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="flex items-center gap-2">
                        {ordine.data_di_conferma ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-slate-700">
                            <Lucide icon="Calendar" className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-sm font-medium">
                              {dayjs(ordine.data_di_conferma).format("DD/MM/YYYY HH:mm")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500 italic">Data non disponibile</span>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed relative text-center dark:bg-darkmode-600">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => onViewDetails(ordine.id)}
                        className="shadow-sm hover:shadow-md transition-shadow"
                      >
                        <Lucide icon="Eye" className="w-4 h-4 mr-2" />
                        Visualizza
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={5} className="py-16 text-center bg-slate-50/30">
                    <EmptyState
                      icon={searchQuery ? "Search" : "CircleCheck"}
                      title={searchQuery ? "Nessun risultato trovato" : "Nessun ordine completato"}
                      description={searchQuery ? `Nessun ordine trovato per "${searchQuery}"` : "Gli ordini di stampa revisionati appariranno qui una volta inviati alla tipografia."}
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

export default ODSCompletatiSection;
