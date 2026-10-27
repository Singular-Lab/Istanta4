import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import FileIcon from '@/components/Base/FileIcon';
import BarraFiltri from '@/components/Base/BarraFiltri';
import CampoRicerca from '@/components/Base/CampoRicerca';
import { FormField, FormInput, FormSelect } from '@/components/Base/Form';
import { Dialog, Menu } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import ConfirmDialog from '@/components/ConfirmDialog';
import EmptyState from '@/components/EmptyState';
import { useNotification } from '@/context/NotificationContext';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLoaderData, useNavigate, useRevalidator } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import * as yup from 'yup';
import { TIPO_PAGINA } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import { AreaResponseDTO, CanaleResponseDTO, PuntoVenditaResponseDTO } from '../../../server/core/dto';

const schema = yup.object().shape({
  nomeWorkspace: yup.string().required('Il nome del workspace è obbligatorio'),
  idArea: yup.string().notRequired(),
  idCanale: yup.string().notRequired(),
  idPuntoVendita: yup.string().notRequired()
});

function Main() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [showDialogCreaWorkspace, setShowDialog] = useState(false);
  const [showDialogClonaWorkspace, setShowDialogClonaWorkspace] = useState(false);
  const [showDialogEliminaWorkspace, setShowDialogEliminaWorkspace] = useState(false);
  const [workspaceDaClonare, setWorkspaceDaClonare] = useState<string>("");
  const [idCanaleSelezionato, setIdCanaleSelezionato] = useState<string>("");
  const [idAreaSelezionata, setIdAreaSelezionata] = useState<string>("");
  const [idPuntoVenditaSelezionato, setIdPuntoVenditaSelezionato] = useState<string>("");
  const [nomeWorkspace, setNomeWorkspace] = useState<string>("");
  const { showNotification } = useNotification();
  const revalidator = useRevalidator();
  const [ricercaWorkspace, setRicercaWorkspace] = useState("");
  const { aree, canali, workspaces, puntiVendita } = useLoaderData() as {
    aree: AreaResponseDTO[],
    canali: CanaleResponseDTO[],
    puntiVendita: PuntoVenditaResponseDTO[],
    workspaces: {
      idWorkspace: string,
      nomeWorkspace: string,
      idArea: string,
      idCanale: string,
      idGDO: string,
      idPuntoVendita?: string,
      nomePuntoVendita?: string,
      nomeArea?: string,
      nomeCanale?: string
      isGlobal?: boolean,
      webpliant: any[],
      sitemap: any[]
    }[]
  }


  const workspacesVisibili = workspaces?.filter((w) =>
    w.nomeWorkspace?.toLowerCase().includes(ricercaWorkspace.trim().toLowerCase())
  );

  // usa lo schema yup e hookform

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: yupResolver(schema)
  })


  const mutationCreazioneWorkspace = useMutation({
    mutationFn: async (data: {
      nomeWorkspace: string, idArea: string, idCanale: string, idPuntoVendita?: string, webpliant: any[], sitemap: any[]
    }) => {
      // Nessun catch: l'errore deve arrivare a onError, non diventare un "creato con successo"
      const payload = {
        ...data,
        idPV: data.idPuntoVendita || undefined,
        idPuntoVendita: undefined
      };
      const result = await ServerCall.put("/aggiungiWorkspaceWebPliant", payload);
      revalidator.revalidate();
      return result;
    },
    onSettled: () => {
      // Ricarica i dati
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onSuccess: () => {
      showNotification("Workspace creato con successo", { variant: "success" });
      setShowDialog(false);
      setWorkspaceDaClonare("");
      reset();
    },
    onError: (error) => {
      showNotification(`Errore durante la creazione del workspace: ${error.message}`, { variant: "error" });
      setShowDialog(false);
      reset();
    }

  });


  const mutationEliminaWorkspace = useMutation({
    mutationFn: async (data: {
      idWorkspace: string
    }) => {
      const result = await ServerCall.delete(`/eliminaWorkspaceWebPliant?id=${data.idWorkspace}`);
      revalidator.revalidate();
      return result;
    },
    onSettled: () => {
      // Ricarica i dati
      queryClient.invalidateQueries({ queryKey: ['workspace'] });

    },
    onSuccess: () => {
      showNotification("Workspace eliminato con successo", { variant: "success" });
      setShowDialogEliminaWorkspace(false);
      setWorkspaceDaClonare("");
    },
    onError: (error) => {
      showNotification(`Errore durante l'eliminazione del workspace: ${error.message}`, { variant: "error" });
      setShowDialogEliminaWorkspace(false);
    }

  });

  const workspaceDaEliminare = workspaces?.find((workspace) => workspace.idWorkspace === workspaceDaClonare);
  const filtroAttivo = ricercaWorkspace.trim() !== "";

  return (
    <>
      <Dialog size="lg" centered={true} open={showDialogCreaWorkspace} onClose={() => setShowDialog(false)}>
        <Dialog.Panel>
          <Dialog.Title>Crea un nuovo workspace</Dialog.Title>
          <form onSubmit={handleSubmit((data) => {
            mutationCreazioneWorkspace.mutate({
              nomeWorkspace: data.nomeWorkspace,
              idArea: data.idArea || "",
              idCanale: data.idCanale || "",
              idPuntoVendita: data.idPuntoVendita || "",
              webpliant: [{
                id: uuidv4(),
                tipo: TIPO_PAGINA.HOMEPAGE,
                nome: "Homepage",
                struttura: []
              }],
              sitemap: []

            });
          })}>
            <Dialog.Description className="flex flex-col gap-4">
              <FormField etichetta="Nome del workspace" obbligatorio errore={errors.nomeWorkspace?.message}>
                <FormInput
                  id='workspace-name'
                  type="text"
                  {...register('nomeWorkspace')}
                />
              </FormField>
              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <FormField etichetta="Area del workspace" errore={errors.idArea?.message}>
                  <FormSelect id='workspace-area' {...register('idArea')}>
                    <option value={""}>Scegli un'area</option>
                    {aree?.map((area) => (
                      <option key={area.id} value={area.id}>{area.nome}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField etichetta="Canale del workspace" errore={errors.idCanale?.message}>
                  <FormSelect id='workspace-canale' {...register('idCanale')}>
                    <option value={""}>Scegli un canale</option>
                    {canali?.map((canale) => (
                      <option key={canale.id} value={canale.id}>{canale.nome}</option>
                    ))}
                  </FormSelect>
                </FormField>
              </div>
              <FormField etichetta="Punto vendita (opzionale)" errore={errors.idPuntoVendita?.message}>
                <FormSelect id='workspace-punto-vendita' {...register('idPuntoVendita')}>
                  <option value={""}>Scegli un punto vendita</option>
                  {puntiVendita?.map((pv) => (
                    <option key={pv.id} value={pv.id}>{pv.nome} - {pv.citta}</option>
                  ))}
                </FormSelect>
              </FormField>
            </Dialog.Description>
            <Dialog.Footer>
              <Button type="button" onClick={() => setShowDialog(false)} variant="outline-secondary">
                Annulla
              </Button>
              <Button type="submit" variant="primary" loading={mutationCreazioneWorkspace.isPending} disabled={mutationCreazioneWorkspace.isPending}>
                Crea
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Panel>
      </Dialog>
      <Dialog size='lg' centered={true} open={showDialogClonaWorkspace} onClose={() => setShowDialogClonaWorkspace(false)}>
        <Dialog.Panel>
          <Dialog.Title>Clona un workspace</Dialog.Title>
          <Dialog.Description className="flex flex-col gap-4">
            <FormField etichetta="Nome del workspace">
              <FormInput
                id='clona-workspace-name'
                type="text"
                onChange={(e) => {
                  setNomeWorkspace(e.target.value);
                }}
                value={nomeWorkspace}
              />
            </FormField>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <FormField etichetta="Area del workspace">
                <FormSelect value={idAreaSelezionata} onChange={(e) => { setIdAreaSelezionata(e.target.value) }} id='clona-workspace-area'>
                  <option value={""}>Scegli un'area</option>
                  {aree?.map((area) => (
                    <option key={area.id} value={area.id}>{area.nome}</option>
                  ))}
                </FormSelect>
              </FormField>
              <FormField etichetta="Canale del workspace">
                <FormSelect value={idCanaleSelezionato} onChange={(e) => { setIdCanaleSelezionato(e.target.value) }} id='clona-workspace-canale'>
                  <option value={""}>Scegli un canale</option>
                  {canali?.map((canale) => (
                    <option key={canale.id} value={canale.id}>{canale.nome}</option>
                  ))}
                </FormSelect>
              </FormField>
            </div>
            <FormField etichetta="Punto vendita (opzionale)">
              <FormSelect value={idPuntoVenditaSelezionato} onChange={(e) => { setIdPuntoVenditaSelezionato(e.target.value) }} id='workspace-punto-vendita-clona'>
                <option value={""}>Scegli un punto vendita</option>
                {puntiVendita?.map((pv) => (
                  <option key={pv.id} value={pv.id}>{pv.nome} - {pv.citta}</option>
                ))}
              </FormSelect>
            </FormField>
          </Dialog.Description>
          <Dialog.Footer>
            <Button onClick={() => setShowDialogClonaWorkspace(false)} variant="outline-secondary">
              Annulla
            </Button>
            <Button variant="primary" loading={mutationCreazioneWorkspace.isPending} disabled={mutationCreazioneWorkspace.isPending} onClick={() => {
              mutationCreazioneWorkspace.mutate({
                nomeWorkspace,
                idArea: idAreaSelezionata,
                idCanale: idCanaleSelezionato,
                idPuntoVendita: idPuntoVenditaSelezionato,
                webpliant: workspaces?.find((workspace) => workspace.idWorkspace === workspaceDaClonare)?.webpliant || [],
                sitemap: workspaces?.find((workspace) => workspace.idWorkspace === workspaceDaClonare)?.sitemap || []
              }, {
                // Il dialog resta aperto (pulsante in caricamento) fino alla risposta
                onSettled: () => setShowDialogClonaWorkspace(false),
              });
            }}>
              Clona
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      {/* Il dialogo resta aperto, con il pulsante in caricamento, fino alla risposta del server */}
      <ConfirmDialog
        open={showDialogEliminaWorkspace}
        title="Eliminare il workspace?"
        description={
          (workspaceDaEliminare?.webpliant ?? []).length > 0 ? (
            <>
              Questa azione non può essere annullata. Eliminando il workspace perderai il Webpliant
              per l'area <strong>{aree.find((area) => workspaceDaEliminare?.idArea === area.id)?.nome}</strong>
              {" "}e il canale <strong>{canali.find((canale) => workspaceDaEliminare?.idCanale === canale.id)?.nome}</strong>.
            </>
          ) : (
            "Questa azione non può essere annullata."
          )
        }
        confirmLabel="Elimina"
        loading={mutationEliminaWorkspace.isPending}
        onClose={() => setShowDialogEliminaWorkspace(false)}
        onConfirm={() => {
          mutationEliminaWorkspace.mutate({
            idWorkspace: workspaceDaClonare
          });
        }}
      />
      <Pagina
        titolo="Impostazioni Webpliant"
        descrizione="Costruisci le impostazioni per il tuo webpliant"
        azioni={
          <>
            <Button
              variant="outline-secondary"
              onClick={() => {
                navigate('/webliant/impostazioni-webpliant/configurazione-webpliant');
              }}
            >
              <Lucide icon="Cog" aria-hidden="true" className="mr-2 h-4 w-4" />
              Impostazioni
            </Button>
            <Button variant="primary" onClick={() => setShowDialog(true)}>
              <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
              Crea workspace
            </Button>
          </>
        }
      >
        <Sezione senzaPadding titolo="Workspace" descrizione="Ogni workspace raccoglie le pagine Webpliant di un'area e un canale">
          <BarraFiltri>
            <CampoRicerca
              etichetta="Cerca workspace"
              placeholder="Ricerca workspace"
              value={ricercaWorkspace}
              onChange={setRicercaWorkspace}
            />
          </BarraFiltri>
          {workspacesVisibili && workspacesVisibili.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {/* Workspace Card */}
              {workspacesVisibili.map((value, index) => (
                <Link preventScrollReset target="_blank" rel="noopener noreferrer" to={`/webliant/impostazioni-webpliant/workspace?id=${value.idWorkspace}`} key={index} className="relative cursor-pointer rounded-card border border-slate-200 bg-white px-3 pb-5 pt-8 transition hover:bg-slate-50">
                  <FileIcon
                    className="w-2/4 mx-auto"
                    variant="directory"
                  />
                  <div
                    className="block mt-4 font-medium text-center capitalize truncate"
                  >
                    {value.nomeWorkspace}
                  </div>
                  <div className='mt-1 flex flex-row flex-wrap justify-center gap-x-2 gap-y-1 text-center'>
                    {
                      value.isGlobal ? <Badge variant="success" size='sm' border>
                        Globale
                      </Badge> :
                        <>
                          <Badge variant="info" size='sm' border>
                            {value.nomeArea}
                          </Badge>
                          <Badge variant="info" size='sm' border>
                            {value.nomeCanale}
                          </Badge>
                          {value.nomePuntoVendita && (
                            <Badge variant="warning" size='sm' border>
                              {value.nomePuntoVendita}
                            </Badge>
                          )}
                        </>
                    }
                  </div>
                  <Menu className="absolute top-0 right-0 mt-3 mr-2">
                    {/* Resta un div: la card è un link e non può contenere un button */}
                    <Menu.Button
                      as="div"
                      role="button"
                      tabIndex={0}
                      className="block w-5 h-5"
                      aria-label={`Azioni workspace ${value.nomeWorkspace}`}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                      }}
                    >
                      <Lucide
                        icon="EllipsisVertical"
                        aria-hidden="true"
                        className="h-5 w-5 text-slate-400"
                      />
                    </Menu.Button>
                    <Menu.Items className="w-52">
                      <Menu.Item onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        setShowDialogClonaWorkspace(true);
                        setNomeWorkspace(`${value.nomeWorkspace}_COPIA`);
                        setWorkspaceDaClonare(value.idWorkspace);
                      }}>
                        <Lucide icon="Copy" aria-hidden="true" className="w-4 h-4 mr-2" />
                        Clona
                      </Menu.Item>
                      <Menu.Item onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        setShowDialogEliminaWorkspace(true);
                        setWorkspaceDaClonare(value.idWorkspace);
                      }} className={"text-danger"}>
                        <Lucide icon="Trash2" aria-hidden="true" className="w-4 h-4 mr-2" />
                        Elimina workspace
                      </Menu.Item>
                    </Menu.Items>
                  </Menu>
                </Link>
              ))}
            </div>
          ) : filtroAttivo && (workspaces?.length ?? 0) > 0 ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Nessun risultato"
              description="Nessun workspace corrisponde alla ricerca."
              buttonText="Azzera ricerca"
              buttonIcon="X"
              onButtonClick={() => setRicercaWorkspace("")}
            />
          ) : (
            <EmptyState
              compatta
              icon="Workflow"
              title="Nessun workspace"
              description="Non ci sono workspace disponibili"
              buttonText="Crea workspace"
              buttonIcon="Plus"
              onButtonClick={() => setShowDialog(true)}
            />
          )}
        </Sezione>
      </Pagina>
    </>
  );
}

export default Main;
// export default withSessionCheck(Main);
