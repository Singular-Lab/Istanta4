import Alert from '@/components/Base/Alert';
import Button from "@/components/Base/Button";
import { FormInput } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import LoadingIcon from '@/components/Base/LoadingIcon';
import Lucide from "@/components/Base/Lucide";
import EmptyState from '@/components/EmptyState';
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
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Tipo Export eliminato con successo</div>
          </div>
        </div>
      );
      tipiExport.refetch();
      handleChiudiModaleEliminazione();
    },
    onError: (error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleX" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'eliminazione del Tipo Export</div>
            <div className="mt-1 text-slate-500">
              {error instanceof Error ? error.message : "Si è verificato un errore durante l'eliminazione. Riprova più tardi."}
            </div>
          </div>
        </div>
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
      {/* Modale di Eliminazione */}
      <Dialog
        open={isModaleEliminazioneAperto && selectedTipiExportDaEliminare != undefined}
        onClose={handleChiudiModaleEliminazione}
      >
        <Dialog.Panel className="p-1">
          <Dialog.Title className="px-5 pt-5">
            <h2 className="mr-auto text-base font-medium">
              Elimina tipo export: <span className="font-semibold text-danger">{selectedTipiExportDaEliminare?.nome}</span>
            </h2>
          </Dialog.Title>
          <Dialog.Description className="p-5">
            Sei sicuro di voler eliminare questo tipo di export? Questa operazione non può essere annullata.
          </Dialog.Description>
          <Dialog.Footer className="px-5 py-3 text-right border-t border-slate-200/60 dark:border-darkmode-400">
            <Button
              type="button"
              variant="outline-secondary"
              onClick={handleChiudiModaleEliminazione}
              className="w-24 mr-2"
              disabled={mutationEliminazioneTipiExport.isPending}
            >
              Annulla
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleEliminaTipoExport}
              className="w-24"
              disabled={mutationEliminazioneTipiExport.isPending}
            >
              {mutationEliminazioneTipiExport.isPending ? (
                <div className="flex items-center justify-center">
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Elimino...
                </div>
              ) : "Elimina"}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Contenuto principale */}
      <div className="grid grid-cols-12 gap-y-7 gap-x-6 mt-3.5">
        <div className="col-span-12">
          {/* Header con titolo e statistiche */}
          <div className="flex flex-col gap-y-7">
            <div className="flex flex-col">
              {/* Barra di ricerca */}
              <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
                <div className="flex-1">
                  <div className="relative">
                    <Lucide
                      icon="Search"
                      className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                    />
                    <FormInput
                      type="text"
                      placeholder="Cerca tipi export per nome o codice..."
                      className="pl-9 sm:w-80 rounded-[0.5rem]"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                {searchTerm && (
                  <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={handleClearFilters}
                    >
                      <Lucide icon="X" className="w-4 h-4 mr-2" />
                      Pulisci ricerca
                    </Button>
                  </div>
                )}
              </div>

              {/* Stati loading, error e empty */}
              {tipiExport.isLoading && (
                <div className="flex justify-center items-center py-16">
                  <div className="text-center">
                    <LoadingIcon icon="tail-spin" className="w-8 h-8 mx-auto mb-4" />
                    <div className="text-slate-600 font-medium">Caricamento tipi export...</div>
                    <div className="text-slate-500 text-sm mt-1">Attendere prego</div>
                  </div>
                </div>
              )}

              {tipiExport.isError && (
                <div className="p-5">
                  <Alert variant="danger" className="flex items-center">
                    <Lucide icon="TriangleAlert" className="w-6 h-6 mr-3" />
                    <div>
                      <div className="font-medium">Errore durante il caricamento</div>
                      <div className="mt-1">Non è stato possibile caricare i tipi export. Riprova più tardi.</div>
                    </div>
                  </Alert>
                </div>
              )}

              {!tipiExport.isLoading && !tipiExport.isError && (!tipiExport.data || tipiExport.data.length === 0) && (
                <div className="p-5">
                  <EmptyState
                    icon="FileDown"
                    title="Nessun tipo export disponibile"
                    description="Non ci sono tipi di export configurati nel sistema. Utilizza il pulsante 'Nuovo tipo export' per aggiungerne uno."
                    buttonText="Ricarica"
                    onButtonClick={tipiExport.refetch}
                    iconColor="text-slate-400"
                  />
                </div>
              )}

              {!tipiExport.isLoading && !tipiExport.isError && tipiExport.data && tipiExport.data.length > 0 && filteredTipiExport?.length === 0 && (
                <div className="p-5">
                  <EmptyState
                    icon="Search"
                    title="Nessun risultato trovato"
                    description="Non sono stati trovati tipi export che corrispondono ai criteri di ricerca. Prova a modificare la ricerca."
                    buttonText="Pulisci ricerca"
                    onButtonClick={handleClearFilters}
                    iconColor="text-slate-400"
                  />
                </div>
              )}

              {/* Lista dei tipi export in formato tabella professionale */}
              {!tipiExport.isLoading && !tipiExport.isError && filteredTipiExport && filteredTipiExport.length > 0 && (
                <div className="p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Tipo Export
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Codice indesign
                          </th>
                          <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Descrizione
                          </th>
                          <th className="text-center py-3 px-4 font-semibold text-slate-700 text-sm uppercase tracking-wide">
                            Azioni
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTipiExport.map((tipo, index) => (
                          <tr
                            key={tipo.id || index}
                            className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors duration-150"
                          >
                            <td className="py-4 px-4">
                              <div className="flex items-center">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/10 mr-3">
                                  <Lucide
                                    icon="FileDown"
                                    className="w-5 h-5 text-emerald-600"
                                  />
                                </div>
                                <div>
                                  <div className="font-medium text-slate-800">
                                    {tipo.nome}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    Tipo di export
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-sm font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                {tipo.codice}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="text-sm text-slate-600 max-w-xs">
                                <div className="line-clamp-2">
                                  Tipo di export configurato per l'esportazione dei dati
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleOpenModifica(tipo)}
                                  className="hover:bg-primary/5"
                                >
                                  <Lucide icon="PenLine" className="w-4 h-4 mr-1.5" />
                                  Modifica
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleAperturaModaleEliminazione(tipo)}
                                  className="hover:bg-danger/5"
                                >
                                  <Lucide icon="Trash2" className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

PanelTipiExport.displayName = "PanelTipiExport";

export default PanelTipiExport;
