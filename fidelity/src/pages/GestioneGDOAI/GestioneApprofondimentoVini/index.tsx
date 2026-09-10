import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormSelect } from "@/components/Base/Form";
import { Dialog, Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import Table from "@/components/Base/Table";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { ApprofondimentoVino, ReferenzeIstanta } from "../../../../lib/types";

function GestioneApprofondimentoVini() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [selectedVini, setSelectedVini] = useState<(ReferenzeIstanta & { approfondimento: ApprofondimentoVino })[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'generate' | 'delete' | null>(null);
  const [filtri, setFiltri] = useState({
    titolo: "",
    tipo: "",
    data_corrente: ""
  });

  const { data: viniData, isLoading } = useQuery({
    queryKey: ['vini', filtri],
    queryFn: () => ServerCall.put<(ReferenzeIstanta & { approfondimento: ApprofondimentoVino })[]>("/get_vini_cliente_by_filtri_e_promo_in_corso", filtri),
  });

  const vini = viniData || [];

  useEffect(() => {
    console.log('selectedVini:', selectedVini);
    console.log('selectedVini.length:', selectedVini.length);
    console.log('vini totali:', vini.length);
    console.log('vini sample:', vini[0]);
  }, [selectedVini, vini]);

  // Funzione intelligente per determinare il tipo di vino dal colore
  const determinaTipoVino = (colore: string | undefined): {
    tipo: string;
    variant: 'danger' | 'primary' | 'secondary' | 'warning' | 'success';
    icon: string;
  } => {
    if (!colore) return { tipo: "Non specificato", variant: "secondary", icon: "HelpCircle" };

    const coloreMinuscolo = colore.toLowerCase();

    // Controlli per vino rosso
    if (coloreMinuscolo.includes('rosso') ||
      coloreMinuscolo.includes('ruby') ||
      coloreMinuscolo.includes('granato') ||
      coloreMinuscolo.includes('bordeaux') ||
      coloreMinuscolo.includes('porpora') ||
      coloreMinuscolo.includes('ciliegia') ||
      coloreMinuscolo.includes('violaceo')) {
      return { tipo: "Rosso", variant: "danger", icon: "Wine" };
    }

    // Controlli per vino bianco
    if (coloreMinuscolo.includes('bianco') ||
      coloreMinuscolo.includes('giallo') ||
      coloreMinuscolo.includes('paglierino') ||
      coloreMinuscolo.includes('dorato') ||
      coloreMinuscolo.includes('ambrato') ||
      coloreMinuscolo.includes('verdolino') ||
      coloreMinuscolo.includes('cristallino')) {
      return { tipo: "Bianco", variant: "warning", icon: "Sparkles" };
    }

    // Controlli per vino rosato
    if (coloreMinuscolo.includes('rosato') ||
      coloreMinuscolo.includes('rosa') ||
      coloreMinuscolo.includes('cerasuolo') ||
      coloreMinuscolo.includes('chiaretto') ||
      coloreMinuscolo.includes('salmone')) {
      return { tipo: "Rosato", variant: "primary", icon: "Heart" };
    }

    // Controlli per spumante/champagne
    if (coloreMinuscolo.includes('spumante') ||
      coloreMinuscolo.includes('champagne') ||
      coloreMinuscolo.includes('prosecco') ||
      coloreMinuscolo.includes('brut') ||
      coloreMinuscolo.includes('bollicine')) {
      return { tipo: "Spumante", variant: "success", icon: "Zap" };
    }

    return { tipo: "Altro", variant: "secondary", icon: "Grape" };
  };

  // Mutation per generazione massive approfondimenti
  const generateMassiveMutation = useMutation({
    mutationFn: async (params: { codici: string[], referenze: ReferenzeIstanta[] }) => {
      const { codici, referenze } = params;
      const promises = codici.map(codice => {
        const referenza = referenze.find(r => r.dataFields.codice_referenza === codice);
        if (!referenza) {
          throw new Error(`Referenza non trovata per il codice ${codice}`);
        }
        return ServerCall.put('/create_approfondimento_vino', {
          codice,
          anno: new Date().getFullYear(),
          nome: [referenza.dataFields.descrizione_uno, referenza.dataFields.descrizione_tre].filter(Boolean).join(" "),
          cantina: referenza.dataFields.descrizione_due
        })
      })
      return Promise.allSettled(promises);
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-green-500" />
          <span>Approfondimenti generati: {successful} successi, {failed} errori</span>
        </div>
      </>, {
        variant: successful > 0 ? "success" : "error",
        duration: 5000,
        position: "top-right"
      });

      // Refresh data e reset selezioni
      queryClient.invalidateQueries({ queryKey: ['vini'] });
      setSelectedVini([]);
      setSelectAll(false);
    },
    onError: () => {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleAlert" className="w-4 h-4 text-red-500" />
          <span>Errore durante la generazione degli approfondimenti</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
    }
  });

  // Mutation per eliminazione massive approfondimenti
  const deleteMassiveMutation = useMutation({
    mutationFn: async (codici: string[]) => {
      const promises = codici.map(codice =>
        ServerCall.delete(`/delete_approfondimento_vino/${codice}`)
      );
      return Promise.allSettled(promises);
    },
    onSuccess: (results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-green-500" />
          <span>Approfondimenti eliminati: {successful} successi, {failed} errori</span>
        </div>
      </>, {
        variant: "success",
        duration: 5000,
        position: "top-right"
      });

      // Refresh data e reset selezioni
      queryClient.invalidateQueries({ queryKey: ['vini'] });
      setSelectedVini([]);
      setSelectAll(false);
    },
    onError: () => {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleAlert" className="w-4 h-4 text-red-500" />
          <span>Errore durante l'eliminazione degli approfondimenti</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
    }
  });

  // Funzioni per gestione selezioni
  const handleSelectAll = (checked: boolean) => {
    console.log('handleSelectAll called:', checked);
    setSelectAll(checked);
    if (checked) {
      setSelectedVini(vini);
    } else {
      setSelectedVini([]);
    }
  };

  const handleSelectVino = (vino: ReferenzeIstanta & { approfondimento: ApprofondimentoVino }, checked: boolean) => {
    console.log('handleSelectVino called:', checked, vino.dataFields.codice_referenza);
    const codicevino = vino.dataFields.codice_referenza;

    if (checked) {
      setSelectedVini([...selectedVini, vino]);
    } else {
      // Usa il codice referenza invece dell'id per il confronto
      setSelectedVini(selectedVini.filter(v => v.dataFields.codice_referenza !== codicevino));
    }
  };

  // Aggiorna selectAll quando cambia la selezione
  useEffect(() => {
    setSelectAll(selectedVini.length === vini.length && vini.length > 0);
  }, [selectedVini.length, vini.length]);

  // Funzioni per azioni massive
  const handleGenerateMassive = () => {
    const codiciSenzaApprofondimento = selectedVini
      .filter(v => !v.approfondimento)
      .map(v => v.dataFields.codice_referenza);

    if (codiciSenzaApprofondimento.length === 0) {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="Info" className="w-4 h-4 text-blue-500" />
          <span>Tutti i vini selezionati hanno già un approfondimento</span>
        </div>
      </>, {
        variant: "info",
        duration: 3000,
        position: "top-right"
      });
      return;
    }

    setConfirmAction('generate');
    setShowConfirmDialog(true);
  };

  const handleDeleteMassive = () => {
    const codiciConApprofondimento = selectedVini
      .filter(v => v.approfondimento)
      .map(v => v.dataFields.codice_referenza);

    if (codiciConApprofondimento.length === 0) {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="Info" className="w-4 h-4 text-blue-500" />
          <span>Nessun vino selezionato ha un approfondimento da eliminare</span>
        </div>
      </>, {
        variant: "info",
        duration: 3000,
        position: "top-right"
      });
      return;
    }

    setConfirmAction('delete');
    setShowConfirmDialog(true);
  };

  const executeAction = () => {
    if (confirmAction === 'generate') {
      const codici = selectedVini
        .filter(v => !v.approfondimento)
        .map(v => v.dataFields.codice_referenza as string);
      generateMassiveMutation.mutate({ codici, referenze: selectedVini });
    } else if (confirmAction === 'delete') {
      const codici = selectedVini
        .filter(v => v.approfondimento)
        .map(v => v.dataFields.codice_referenza as string);
      deleteMassiveMutation.mutate(codici);
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  const getConfirmMessage = () => {
    if (confirmAction === 'generate') {
      const count = selectedVini.filter(v => !v.approfondimento).length;
      return `Sei sicuro di voler generare ${count} nuovi approfondimenti? Questa operazione potrebbe richiedere alcuni minuti.`;
    } else if (confirmAction === 'delete') {
      const count = selectedVini.filter(v => v.approfondimento).length;
      return `Sei sicuro di voler eliminare ${count} approfondimenti? Questa azione non può essere annullata.`;
    }
    return '';
  };

  // Badge componente per il tipo di vino
  const TipoVinoBadge = ({ colore }: { colore: string | undefined }) => {
    const { tipo, variant, icon } = determinaTipoVino(colore);

    return (
      <div className={clsx(
        "inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium",
        variant === "danger" && "bg-red-100 text-red-800",
        variant === "warning" && "bg-yellow-100 text-yellow-800",
        variant === "primary" && "bg-pink-100 text-pink-800",
        variant === "success" && "bg-green-100 text-green-800",
        variant === "secondary" && "bg-slate-100 text-slate-600"
      )}>
        <Lucide icon={icon as any} className="w-3 h-3 mr-1" />
        {tipo}
      </div>
    );
  };

  const isProcessing = generateMassiveMutation.isPending || deleteMassiveMutation.isPending;

  return (
    <div className="flex flex-col w-full">
      <PageHeader
        title="Gestione Approfondimenti Vini"
        description="Elenco approfondimenti vini"
      />
      {/* Dialog di conferma */}
      <Dialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        size="md"
        centered
      >
        <Dialog.Panel>
          <Dialog.Title className="font-medium">
            <h2 className="text-xl flex items-center">
              <Lucide
                icon={confirmAction === 'generate' ? "TriangleAlert" : "CircleAlert"}
                className={clsx(
                  "w-6 h-6 mr-2",
                  confirmAction === 'generate' ? "text-blue-500" : "text-red-500"
                )}
              />
              Conferma {confirmAction === 'generate' ? 'Generazione' : 'Eliminazione'}
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <p className="mb-4 text-slate-600">
              {getConfirmMessage()}
            </p>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setShowConfirmDialog(false)}
              className="w-24 mr-1"
            >
              Annulla
            </Button>
            <Button
              variant={confirmAction === 'generate' ? "primary" : "danger"}
              onClick={executeAction}
              loading={isProcessing}
              disabled={isProcessing}
            >
              {confirmAction === 'generate' ? 'Genera' : 'Elimina'}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <div className="flex flex-col w-full box box--stacked">
        {/* Barra filtri e azioni */}
        <div className="flex flex-col gap-4 p-5 border-b border-slate-200/60">
          {/* Filtri di ricerca */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Lucide
                icon="Search"
                className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
              />
              <FormInput
                type="text"
                placeholder="Cerca vini per nome..."
                className="pl-9 rounded-[0.5rem]"
                value={filtri.titolo}
                onChange={(e) => setFiltri({ ...filtri, titolo: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <FormSelect
                value={filtri.tipo}
                onChange={(e) => setFiltri({ ...filtri, tipo: e.target.value })}
                className="rounded-[0.5rem] w-40"
              >
                <option value="">Tutti i tipi</option>
                <option value="rosso">Rosso</option>
                <option value="bianco">Bianco</option>
                <option value="rosato">Rosato</option>
                <option value="spumante">Spumante</option>
              </FormSelect>
              <FormInput
                type="date"
                placeholder="Data di riferimento"
                value={filtri.data_corrente}
                onChange={(e) => setFiltri({ ...filtri, data_corrente: e.target.value })}
                className="rounded-[0.5rem] w-44"
              />
            </div>
          </div>

          {/* Azioni massive - appare solo quando ci sono selezioni */}
          {selectedVini.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                  <span className="font-medium text-slate-700">
                    {selectedVini.length} vini selezionati
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-300"></div>
                <span className="text-sm text-slate-600">
                  {selectedVini.filter(v => !v.approfondimento).length} senza approfondimento • {selectedVini.filter(v => v.approfondimento).length} con approfondimento
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PermissionGate permission={PERMISSIONS.AI.GESTISCI_VINI} mode="disable">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateMassive}
                    disabled={isProcessing || selectedVini.filter(v => !v.approfondimento).length === 0}
                    loading={generateMassiveMutation.isPending}
                    className="shadow-sm"
                  >
                    <Lucide icon="Sparkles" className="stroke-[1.3] w-4 h-4 mr-2" />
                    Genera {selectedVini.filter(v => !v.approfondimento).length}
                  </Button>
                </PermissionGate>

                <PermissionGate permission={PERMISSIONS.AI.GESTISCI_VINI}>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleDeleteMassive}
                    disabled={isProcessing || selectedVini.filter(v => v.approfondimento).length === 0}
                    loading={deleteMassiveMutation.isPending}
                    className="shadow-sm"
                  >
                    <Lucide icon="Trash2" className="stroke-[1.3] w-4 h-4 mr-2" />
                    Elimina {selectedVini.filter(v => v.approfondimento).length}
                  </Button>
                </PermissionGate>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedVini([]);
                    setSelectAll(false);
                  }}
                  className="shadow-sm"
                >
                  <Lucide icon="X" className="stroke-[1.3] w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="py-5">
          <Table className="border-b border-slate-200/60">
            <Table.Thead>
              <Table.Tr>
                <Table.Td className="w-5 py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  <FormCheck.Input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Foto
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Nome Vino
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Tipo
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Approfondimento
                </Table.Td>
                <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Data Creazione
                </Table.Td>
                <Table.Td className="w-20 py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">
                  Azioni
                </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <Lucide icon="Loader" className="w-5 h-5 mr-2 animate-spin" />
                      Caricamento vini...
                    </div>
                  </Table.Td>
                </Table.Tr>
              ) : vini.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} className="text-center py-8 text-slate-500">
                    <div className="flex flex-col items-center">
                      <Lucide icon="Wine" className="w-8 h-8 mb-2 text-slate-300" />
                      <span>Nessun vino trovato alla data selezionata {filtri.data_corrente ? dayjs(filtri.data_corrente).format("DD/MM/YYYY") : ""}</span>
                      <span className="text-sm">Prova a modificare i filtri di ricerca</span>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ) : (
                vini.map((vino, index) => (
                  <Table.Tr key={index} className="hover:bg-slate-50">
                    <Table.Td>
                      <FormCheck.Input
                        type="checkbox"
                        checked={selectedVini.some(v => v.dataFields.codice_referenza === vino.dataFields.codice_referenza)}
                        onChange={(e) => handleSelectVino(vino, e.target.checked)}
                      />
                    </Table.Td>
                    <Table.Td>
                      {vino.foto && vino.foto.length > 0 ? (
                        <img
                          src={vino.foto[0]}
                          alt="Foto vino"
                          className="w-12 h-12 object-contain rounded-lg shadow-sm border border-slate-200"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
                          <Lucide icon="ImageOff" className="w-5 h-5 text-slate-400" />
                        </div>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {vino.dataFields.descrizione_uno || "Vino senza nome"}
                        </span>
                        <span className="text-sm text-slate-500">
                          {[
                            vino.dataFields.descrizione_due,
                            vino.dataFields.descrizione_tre
                          ]
                            .filter(Boolean)
                            .join(" ") || "Nessuna descrizione"}
                        </span>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <TipoVinoBadge colore={vino?.approfondimento?.colore} />
                    </Table.Td>
                    <Table.Td>
                      {vino.approfondimento ? (
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                          <span className="text-green-700 font-medium">Completato</span>
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-orange-400 rounded-full mr-2"></div>
                          <span className="text-orange-700 font-medium">Mancante</span>
                        </div>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <span className="text-slate-600">
                        {dayjs(vino.createdAt).format("DD/MM/YYYY")}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      <div className="flex items-center justify-center">
                        <Popover className="h-5">
                          <Popover.Button className="w-5 h-5 text-slate-500 hover:text-slate-700">
                            <Lucide
                              icon="EllipsisVertical"
                              className="w-5 h-5 stroke-slate-400/70 fill-slate-400/70"
                            />
                          </Popover.Button>
                          <Popover.Panel className="w-48">
                            <div className="flex flex-col">
                              <button
                                onClick={() => navigate(`/gestione-approfondimento-vini/modifica?codice=${vino.dataFields.codice_referenza}`)}
                                className="flex items-center px-3 py-2 hover:bg-slate-100 text-left"
                              >
                                <Lucide icon="SquarePen" className="w-4 h-4 mr-2" />
                                {vino.approfondimento ? 'Modifica' : 'Genera'} Approfondimento
                              </button>
                              <button
                                onClick={() => {
                                  // Visualizza dettagli del vino
                                  console.log('Visualizza dettagli:', vino);
                                }}
                                className="flex items-center px-3 py-2 hover:bg-slate-100 text-left"
                              >
                                <Lucide icon="Eye" className="w-4 h-4 mr-2" />
                                Visualizza Dettagli
                              </button>
                            </div>
                          </Popover.Panel>
                        </Popover>
                      </div>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </div>
      </div>
    </div>
  );
}

export default withSessionCheck(GestioneApprofondimentoVini);
