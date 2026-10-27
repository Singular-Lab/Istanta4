import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import Lucide from "@/components/Base/Lucide";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Table from "@/components/Base/Table";
import EmptyState from "@/components/EmptyState";
import { formatData } from "@/utils/format";
import React, { useEffect, useMemo, useState } from "react";
import { PromoResponseDTO } from "../../../../server/core/dto";

interface NuovoODSSectionProps {
  promo: PromoResponseDTO[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onCreateOrder: (promo: PromoResponseDTO) => void;
}

const COLONNE = 3;

const NuovoODSSection: React.FC<NuovoODSSectionProps> = ({ promo, searchQuery, onSearchQueryChange, onCreateOrder }) => {
  const [pagina, setPagina] = useState(1);
  const [righePerPagina, setRighePerPagina] = useState(25);

  const filteredPromo = useMemo(() => {
    if (!searchQuery.trim()) return promo ?? [];
    const query = searchQuery.toLowerCase();
    return (promo ?? []).filter(p =>
      p.nome?.toLowerCase().includes(query)
    );
  }, [promo, searchQuery]);

  // Una nuova ricerca riparte dalla prima pagina
  useEffect(() => setPagina(1), [searchQuery]);

  const promoInPagina = filteredPromo.slice((pagina - 1) * righePerPagina, pagina * righePerPagina);

  return (
    <Sezione
      senzaPadding
      titolo="Promozioni disponibili"
      descrizione="Seleziona una promozione per avviare un nuovo ordine di stampa"
    >
      <BarraFiltri>
        <CampoRicerca
          etichetta="Cerca promozioni"
          placeholder="Nome della promozione"
          value={searchQuery}
          onChange={onSearchQueryChange}
        />
      </BarraFiltri>

      <div className="overflow-x-auto">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Promozione</Table.Th>
              <Table.Th>Periodo di validità</Table.Th>
              <Table.Th className="text-right">
                <span className="sr-only">Azioni</span>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {promoInPagina.length > 0 ? (
              promoInPagina.map((promoItem) => (
                <Table.Tr key={promoItem.id}>
                  <Table.Td>
                    <div className="font-medium text-slate-800">{promoItem.nome}</div>
                    <div className="mt-0.5 text-xs text-slate-500" title={promoItem.id}>
                      ID {promoItem.id.slice(0, 8)}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums text-slate-600">
                      <span>{formatData(promoItem.validita_dal)}</span>
                      <Lucide icon="ArrowRight" aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatData(promoItem.validita_al)}</span>
                    </span>
                  </Table.Td>
                  <Table.Td className="text-right">
                    <Button type="button" variant="outline-secondary" size="sm" onClick={() => onCreateOrder(promoItem)}>
                      Avvia ordine
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

      <PaginazioneTabella
        totale={filteredPromo.length}
        pagina={pagina}
        dimensionePagina={righePerPagina}
        onCambiaPagina={setPagina}
        onCambiaDimensione={setRighePerPagina}
      />
    </Sezione>
  );
};

export default NuovoODSSection;
