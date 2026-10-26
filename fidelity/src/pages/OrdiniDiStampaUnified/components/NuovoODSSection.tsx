import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import dayjs from "dayjs";
import React, { useMemo } from "react";
import { PromoResponseDTO } from "../../../../server/core/dto";

interface NuovoODSSectionProps {
  promo: PromoResponseDTO[];
  searchQuery: string;
  onCreateOrder: (promo: PromoResponseDTO) => void;
}

const NuovoODSSection: React.FC<NuovoODSSectionProps> = ({ promo, searchQuery, onCreateOrder }) => {
  const filteredPromo = useMemo(() => {
    if (!searchQuery.trim()) return promo;
    const query = searchQuery.toLowerCase();
    return promo?.filter(p =>
      p.nome?.toLowerCase().includes(query)
    );
  }, [promo, searchQuery]);

  return (
    <div>
      <div className="flex flex-col box box--stacked shadow-sm">
        {/* Enhanced Header with gradient background */}
        <div className="relative flex items-center gap-x-3 p-6 border-b border-slate-200/60 bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm">
            <Lucide icon="PackagePlus" className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-800">Promozioni disponibili</h3>
            <p className="text-sm text-slate-600 mt-0.5">Seleziona una promozione per avviare un nuovo ordine di stampa</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white shadow-sm border border-primary/20">
              <span className="text-primary">{filteredPromo?.length || 0}</span>
              <span className="text-slate-600 ml-1">disponibili</span>
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
                    Nome Promozione
                  </div>
                </Table.Td>
                <Table.Td className="py-4 font-semibold border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  <div className="flex items-center gap-2">
                    <Lucide icon="CalendarDays" className="w-4 h-4" />
                    Periodo Validità
                  </div>
                </Table.Td>
                <Table.Td className="py-4 font-semibold text-center border-t bg-slate-50/80 border-slate-200/60 text-slate-700">
                  Azioni
                </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredPromo && filteredPromo.length > 0 ? (
                filteredPromo.map((promoItem) => (
                  <Table.Tr key={promoItem.id} className="[&_td]:last:border-b-0 hover:bg-slate-50/50 transition-colors">
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                          <Lucide icon="Tag" className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">{promoItem.nome}</div>
                          <div className="text-xs text-slate-500 mt-0.5">ID: {promoItem.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-slate-700">
                          <Lucide icon="CalendarClock" className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-sm font-medium">
                            {dayjs(promoItem.validita_dal).format('DD/MM/YYYY')}
                          </span>
                        </div>
                        <Lucide icon="ArrowRight" className="w-4 h-4 text-slate-400" />
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-lg text-slate-700">
                          <Lucide icon="Calendar" className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-sm font-medium">
                            {dayjs(promoItem.validita_al).format('DD/MM/YYYY')}
                          </span>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td className="py-4 border-dashed relative text-center dark:bg-darkmode-600">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onCreateOrder(promoItem)}
                        className="shadow-sm hover:shadow-md transition-shadow"
                      >
                        <Lucide icon="Printer" className="w-4 h-4 mr-2" />
                        Avvia Ordine
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={3} className="py-16 text-center bg-slate-50/30">
                    <EmptyState
                      icon={searchQuery ? "Search" : "PackageX"}
                      title={searchQuery ? "Nessun risultato trovato" : "Nessuna promozione disponibile"}
                      description={searchQuery ? `Nessuna promozione trovata per "${searchQuery}"` : "Le promozioni disponibili appariranno qui. Crea una nuova promozione per iniziare."}
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

export default NuovoODSSection;
