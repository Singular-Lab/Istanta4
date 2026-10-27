import Button from "@/components/Base/Button";
import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormCheck, FormInput, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import type { TonoStato } from "@/constants/stati";
import Table from "@/components/Base/Table";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import { ApprofondimentoVino, ReferenzeIstanta } from "../../../../lib/types";
import { urlFoto } from "@/utils/helper";
import { formatData } from "@/utils/format";

/** Colonne della tabella: selezione, foto, nome, tipo, approfondimento, data, azioni. */
const NUMERO_COLONNE = 7;

/** Tono del badge per il tipo di vino ricavato dal colore. */
const TONO_TIPO_VINO: Record<'danger' | 'primary' | 'secondary' | 'warning' | 'success', TonoStato> = {
  danger: "danger",
  warning: "warning",
  primary: "brand",
  success: "success",
  secondary: "neutral",
};

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

  const { data: viniData, isLoading, isError, error: errore, refetch } = useQuery({
    queryKey: ['vini', filtri],
    queryFn: () => ServerCall.put<(ReferenzeIstanta & { approfondimento: ApprofondimentoVino })[]>("/get_vini_cliente_by_filtri_e_promo_in_corso", filtri),
  });

  const vini = viniData || [];

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
          <Lucide icon="CircleCheck" aria-hidden="true" className="h-4 w-4 text-success" />
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
          <Lucide icon="CircleAlert" className="w-4 h-4 text-danger" />
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
          <Lucide icon="CircleCheck" aria-hidden="true" className="h-4 w-4 text-success" />
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
          <Lucide icon="CircleAlert" className="w-4 h-4 text-danger" />
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
    setSelectAll(checked);
    if (checked) {
      setSelectedVini(vini);
    } else {
      setSelectedVini([]);
    }
  };

  const handleSelectVino = (vino: ReferenzeIstanta & { approfondimento: ApprofondimentoVino }, checked: boolean) => {
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
          <Lucide icon="Info" aria-hidden="true" className="h-4 w-4 text-info" />
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
          <Lucide icon="Info" aria-hidden="true" className="h-4 w-4 text-info" />
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

  const isProcessing = generateMassiveMutation.isPending || deleteMassiveMutation.isPending;
  const filtriAttivi = Boolean(filtri.titolo || filtri.tipo || filtri.data_corrente);
  const daGenerare = selectedVini.filter(v => !v.approfondimento).length;
  const daEliminare = selectedVini.filter(v => v.approfondimento).length;

  return (
    <>
      {/* Conferma delle azioni massive */}
      <ConfirmDialog
        open={showConfirmDialog}
        title={confirmAction === 'generate' ? "Conferma generazione" : "Conferma eliminazione"}
        subtitle={confirmAction === 'generate' ? "Potrebbe richiedere alcuni minuti" : "Azione irreversibile"}
        description={getConfirmMessage()}
        confirmLabel={confirmAction === 'generate' ? 'Genera' : 'Elimina'}
        confirmVariant={confirmAction === 'generate' ? "primary" : "danger"}
        loading={isProcessing}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={executeAction}
      />

      <Pagina titolo="Gestione Approfondimenti Vini" descrizione="Elenco approfondimenti vini">
        <Sezione senzaPadding titolo="Vini" descrizione="Vini delle promozioni in corso e i loro approfondimenti">
          <BarraFiltri>
            <CampoRicerca
              etichetta="Cerca vini"
              placeholder="Cerca vini per nome"
              value={filtri.titolo}
              onChange={(valore) => setFiltri({ ...filtri, titolo: valore })}
            />
            <FormSelect
              formSelectSize="sm"
              aria-label="Tipo"
              value={filtri.tipo}
              onChange={(e) => setFiltri({ ...filtri, tipo: e.target.value })}
              className="sm:w-40"
            >
              <option value="">Tutti i tipi</option>
              <option value="rosso">Rosso</option>
              <option value="bianco">Bianco</option>
              <option value="rosato">Rosato</option>
              <option value="spumante">Spumante</option>
            </FormSelect>
            <FormInput
              type="date"
              formInputSize="sm"
              aria-label="Data di riferimento"
              value={filtri.data_corrente}
              onChange={(e) => setFiltri({ ...filtri, data_corrente: e.target.value })}
              className="sm:w-44"
            />
          </BarraFiltri>

          {/* Azioni massive - appare solo quando ci sono selezioni */}
          {selectedVini.length > 0 && (
            <div className="flex flex-col gap-3 border-b border-dashed border-slate-200 bg-primary/5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-slate-700">
                  {selectedVini.length} vini selezionati
                </span>
                <span aria-hidden="true" className="h-4 w-px bg-slate-300"></span>
                <span className="text-slate-600">
                  {daGenerare} senza approfondimento • {daEliminare} con approfondimento
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PermissionGate permission={PERMISSIONS.AI.GESTISCI_VINI} mode="disable">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateMassive}
                    disabled={isProcessing || daGenerare === 0}
                    loading={generateMassiveMutation.isPending}
                  >
                    {!generateMassiveMutation.isPending && <Lucide icon="Sparkles" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                    Genera {daGenerare}
                  </Button>
                </PermissionGate>

                <PermissionGate permission={PERMISSIONS.AI.GESTISCI_VINI}>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleDeleteMassive}
                    disabled={isProcessing || daEliminare === 0}
                    loading={deleteMassiveMutation.isPending}
                  >
                    {!deleteMassiveMutation.isPending && <Lucide icon="Trash2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                    Elimina {daEliminare}
                  </Button>
                </PermissionGate>

                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedVini([]);
                    setSelectAll(false);
                  }}
                  aria-label="Annulla selezione"
                >
                  <Lucide icon="X" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className="w-5">
                    <FormCheck.Input
                      type="checkbox"
                      aria-label="Seleziona tutti i vini"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </Table.Th>
                  <Table.Th>Foto</Table.Th>
                  <Table.Th>Nome Vino</Table.Th>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Approfondimento</Table.Th>
                  <Table.Th>Data Creazione</Table.Th>
                  <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {isLoading ? (
                  <Table.Tr>
                    <Table.Td colSpan={NUMERO_COLONNE} className="py-8 text-center">
                      <div className="flex items-center justify-center">
                        <Spinner etichetta="Caricamento vini…" />
                      </div>
                    </Table.Td>
                  </Table.Tr>
                ) : isError ? (
                  <Table.Tr>
                    <Table.Td colSpan={NUMERO_COLONNE}>
                      <PageError
                        compatta
                        titolo="Vini non caricati"
                        motivo={(errore as Error)?.message || "Errore durante il recupero dei vini"}
                        onRiprova={() => refetch()}
                      />
                    </Table.Td>
                  </Table.Tr>
                ) : vini.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={NUMERO_COLONNE} className="p-0">
                      {filtriAttivi ? (
                        <EmptyState
                          compatta
                          icon="SearchX"
                          title="Nessun vino trovato"
                          description={
                            filtri.data_corrente
                              ? `Nessun vino alla data selezionata ${formatData(filtri.data_corrente)}: prova a modificare i filtri di ricerca.`
                              : "Prova a modificare i filtri di ricerca."
                          }
                          buttonText="Azzera filtri"
                          buttonIcon="X"
                          onButtonClick={() => setFiltri({ titolo: "", tipo: "", data_corrente: "" })}
                        />
                      ) : (
                        <EmptyState
                          compatta
                          icon="Wine"
                          title="Nessun vino trovato"
                          description="Non ci sono vini nelle promozioni in corso."
                        />
                      )}
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  vini.map((vino, index) => {
                    const tipoVino = determinaTipoVino(vino?.approfondimento?.colore);
                    return (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <FormCheck.Input
                            type="checkbox"
                            aria-label={`Seleziona ${vino.dataFields.descrizione_uno || vino.dataFields.codice_referenza}`}
                            checked={selectedVini.some(v => v.dataFields.codice_referenza === vino.dataFields.codice_referenza)}
                            onChange={(e) => handleSelectVino(vino, e.target.checked)}
                          />
                        </Table.Td>
                        <Table.Td>
                          {vino.foto && vino.foto.length > 0 ? (
                            <img
                              src={urlFoto(vino.foto)[0]}
                              alt="Foto vino"
                              className="h-12 w-12 rounded-control border border-slate-200 object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-control border border-slate-200 bg-slate-100">
                              <Lucide icon="ImageOff" aria-hidden="true" className="h-5 w-5 text-slate-400" />
                            </div>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-800">
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
                          <StatusBadge tono={TONO_TIPO_VINO[tipoVino.variant]} etichetta={tipoVino.tipo} icon={tipoVino.icon} />
                        </Table.Td>
                        <Table.Td>
                          {vino.approfondimento ? (
                            <StatusBadge tono="success" etichetta="Completato" />
                          ) : (
                            <StatusBadge tono="warning" etichetta="Mancante" />
                          )}
                        </Table.Td>
                        <Table.Td className="whitespace-nowrap tabular-nums text-slate-600">
                          {formatData(vino.createdAt)}
                        </Table.Td>
                        <Table.Td className="text-right">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="whitespace-nowrap"
                            onClick={() => navigate(`/gestione-approfondimento-vini/modifica?codice=${vino.dataFields.codice_referenza}`)}
                            aria-label={`${vino.approfondimento ? 'Modifica' : 'Genera'} approfondimento ${vino.dataFields.descrizione_uno || vino.dataFields.codice_referenza}`}
                          >
                            {vino.approfondimento ? 'Modifica' : 'Genera'}
                            <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })
                )}
              </Table.Tbody>
            </Table>
          </div>
        </Sezione>
      </Pagina>
    </>
  );
}

export default withSessionCheck(GestioneApprofondimentoVini);
