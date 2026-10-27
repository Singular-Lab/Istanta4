import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Lucide from "@/components/Base/Lucide";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { formatDataOra, VALORE_ASSENTE } from "@/utils/format";
import React, { useEffect, useMemo, useState } from "react";
import { OrdiniDiStampaResponseDTO } from "../../../../server/core/dto";

interface ODSCompletatiSectionProps {
  ordini: (OrdiniDiStampaResponseDTO & { nomePromo: string })[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onViewDetails: (ordineId: string) => void;
}

const COLONNE = 5;

const ODSCompletatiSection: React.FC<ODSCompletatiSectionProps> = ({ ordini, searchQuery, onSearchQueryChange, onViewDetails }) => {
  const [pagina, setPagina] = useState(1);
  const [righePerPagina, setRighePerPagina] = useState(25);

  const filteredOrdini = useMemo(() => {
    if (!searchQuery.trim()) return ordini ?? [];
    const query = searchQuery.toLowerCase();
    return (ordini ?? []).filter(ordine =>
      ordine.id.toLowerCase().includes(query) ||
      ordine.nomePromo?.toLowerCase().includes(query)
    );
  }, [ordini, searchQuery]);

  // Una nuova ricerca riparte dalla prima pagina
  useEffect(() => setPagina(1), [searchQuery]);

  const ordiniInPagina = filteredOrdini.slice((pagina - 1) * righePerPagina, pagina * righePerPagina);

  return (
    <Sezione senzaPadding titolo="Ordini completati" descrizione="Ordini di stampa inviati alla tipografia">
      <BarraFiltri>
        <CampoRicerca
          etichetta="Cerca ordini"
          placeholder="Promo o ID ordine"
          value={searchQuery}
          onChange={onSearchQueryChange}
        />
      </BarraFiltri>

      <div className="overflow-x-auto">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Ordine</Table.Th>
              <Table.Th>Promozione</Table.Th>
              <Table.Th>Stato</Table.Th>
              <Table.Th>Data conferma</Table.Th>
              <Table.Th className="text-right">
                <span className="sr-only">Azioni</span>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ordiniInPagina.length > 0 ? (
              ordiniInPagina.map((ordine) => (
                <Table.Tr key={ordine.id}>
                  <Table.Td>
                    <span className="font-medium tabular-nums text-slate-800" title={ordine.id}>
                      #{ordine.id.slice(0, 8)}
                    </span>
                  </Table.Td>
                  <Table.Td className="text-slate-700">{ordine.nomePromo}</Table.Td>
                  <Table.Td>
                    <StatusBadge dominio="ordineStampa" stato={ordine.stato} />
                  </Table.Td>
                  <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">
                    {ordine.data_di_conferma ? (
                      formatDataOra(ordine.data_di_conferma)
                    ) : (
                      <span className="text-slate-400">{VALORE_ASSENTE}</span>
                    )}
                  </Table.Td>
                  <Table.Td className="text-right">
                    <Button type="button" variant="outline-secondary" size="sm" onClick={() => onViewDetails(ordine.id)}>
                      Visualizza
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

      <PaginazioneTabella
        totale={filteredOrdini.length}
        pagina={pagina}
        dimensionePagina={righePerPagina}
        onCambiaPagina={setPagina}
        onCambiaDimensione={setRighePerPagina}
      />
    </Sezione>
  );
};

export default ODSCompletatiSection;
