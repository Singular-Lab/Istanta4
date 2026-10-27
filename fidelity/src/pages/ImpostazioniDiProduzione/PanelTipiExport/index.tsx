import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import Table from "@/components/Base/Table";
import ConfirmDialog from "@/components/ConfirmDialog";
import PannelloElenco from "../PannelloElenco";
import { useNotification } from "@/context/NotificationContext";
import { useFetchTipiExport } from '@/query/query';
import { useMutation } from "@tanstack/react-query";
import { forwardRef, useImperativeHandle, useState } from "react";
import { ServerCall } from "../../../../lib/server_call";
import { TipiDiExportResponseDTO } from "../../../../server/core/dto";

type TipiExportProps = {
  onEditTipoExport?: (data: TipiDiExportResponseDTO) => void;
};

export interface PanelTipiExportRefHandle {
  refetchTipiExport: () => void;
}

const PanelTipiExport = forwardRef<PanelTipiExportRefHandle, TipiExportProps>(({ onEditTipoExport }, ref) => {
  const { showNotification } = useNotification();
  const [selectedTipiExportDaEliminare, setSelectedTipiExportDaEliminare] = useState<TipiDiExportResponseDTO | null>(null);
  const [isModaleEliminazioneAperto, setIsModaleEliminazioneAperto] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const tipiExport = useFetchTipiExport();

  useImperativeHandle(ref, () => ({
    refetchTipiExport: tipiExport.refetch
  }));

  // Filtri per la ricerca
  const filteredTipiExport = tipiExport.data?.filter(tipo => {
    const matchesSearch = tipo.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tipo.codice?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const mutationEliminazioneTipiExport = useMutation({
    mutationFn: async (guidId: string) => {
      const response = await ServerCall.delete(`/deleteTipiExport/${guidId}`);
      return response;
    },
    onSuccess: () => {
      showNotification("Tipo di export eliminato con successo", { variant: "success" });
      tipiExport.refetch();
      handleChiudiModaleEliminazione();
    },
    onError: (error) => {
      showNotification(
        `Errore durante l'eliminazione del tipo di export: ${error instanceof Error ? error.message : "riprova più tardi."}`,
        { variant: "error" }
      );
      tipiExport.refetch();
      handleChiudiModaleEliminazione();
    }
  });

  const handleAperturaModaleEliminazione = (tipo: TipiDiExportResponseDTO) => {
    setSelectedTipiExportDaEliminare(tipo);
    setIsModaleEliminazioneAperto(true);
  };

  const handleChiudiModaleEliminazione = () => {
    setIsModaleEliminazioneAperto(false);
    setSelectedTipiExportDaEliminare(null);
  };

  const handleEliminaTipoExport = () => {
    if (selectedTipiExportDaEliminare?.id) {
      mutationEliminazioneTipiExport.mutate(selectedTipiExportDaEliminare.id);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
  };

  // Stato per dialog modifica
  const [showDialogModifica, setShowDialogModifica] = useState(false);
  const [tipiExportEdit, setTipiExportEdit] = useState<TipiDiExportResponseDTO | null>(null);

  // Handler apertura dialog modifica
  const handleOpenModifica = (tipo: TipiDiExportResponseDTO) => {
    setTipiExportEdit(tipo);
    setShowDialogModifica(true);
    if (onEditTipoExport) {
      onEditTipoExport(tipo);
    }
  };

  // Handler chiusura dialog modifica (solo locale, la parent gestisce il suo dialog)
  const handleCloseModifica = () => {
    setShowDialogModifica(false);
    setTipiExportEdit(null);
  };

  return (
    <>
      {/* Conferma di eliminazione */}
      <ConfirmDialog
        open={isModaleEliminazioneAperto && selectedTipiExportDaEliminare != undefined}
        title="Eliminare il tipo di export?"
        description={<>Il tipo di export <strong>{selectedTipiExportDaEliminare?.nome}</strong> verrà eliminato. Questa operazione non può essere annullata.</>}
        confirmLabel="Elimina"
        loading={mutationEliminazioneTipiExport.isPending}
        onClose={handleChiudiModaleEliminazione}
        onConfirm={handleEliminaTipoExport}
      />

      {/* La colonna Descrizione mostrava un testo fisso: il tipo di export non ha una descrizione, quindi non c'è */}
      <PannelloElenco
        ricerca={searchTerm}
        onRicerca={setSearchTerm}
        etichettaRicerca="Cerca tipi di export"
        placeholderRicerca="Nome o codice"
        caricamento={tipiExport.isLoading}
        etichettaCaricamento="Caricamento tipi export…"
        errore={tipiExport.isError ? {
          titolo: "Tipi di export non caricati",
          motivo: (tipiExport.error as Error)?.message || "Non è stato possibile caricare i tipi export.",
          onRiprova: () => tipiExport.refetch(),
        } : null}
        totale={tipiExport.data?.length ?? 0}
        filtrati={filteredTipiExport?.length ?? 0}
        vuoto={{
          icona: "FileDown",
          titolo: "Nessun tipo export disponibile",
          descrizione: "Non ci sono tipi di export configurati. Aggiungine uno con Nuovo tipo.",
        }}
        onAzzeraFiltri={handleClearFilters}
        intestazione={
          <>
            <Table.Th>Tipo export</Table.Th>
            <Table.Th>Codice InDesign</Table.Th>
            <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
          </>
        }
      >
        {filteredTipiExport?.map((tipo, index) => (
          <Table.Tr key={tipo.id || index}>
            <Table.Td className="font-medium text-slate-800">{tipo.nome}</Table.Td>
            <Table.Td>
              <span className="rounded-control bg-slate-100 px-2 py-1 font-mono text-sm text-slate-600">
                {tipo.codice}
              </span>
            </Table.Td>
            <Table.Td className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => handleOpenModifica(tipo)}
                  aria-label={`Modifica tipo di export ${tipo.nome ?? ""}`.trim()}
                  title="Modifica"
                >
                  <Lucide icon="PenLine" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleAperturaModaleEliminazione(tipo)}
                  aria-label={`Elimina tipo di export ${tipo.nome ?? ""}`.trim()}
                  title="Elimina"
                >
                  <Lucide icon="Trash2" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Table.Td>
          </Table.Tr>
        ))}
      </PannelloElenco>
    </>
  );
});

PanelTipiExport.displayName = "PanelTipiExport";

export default PanelTipiExport;
