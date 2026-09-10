import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import FileIcon from '@/components/Base/FileIcon';
import { FormInput, FormLabel, FormSelect } from '@/components/Base/Form';
import { Dialog, Menu, Popover } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
import TomSelect from '@/components/Base/TomSelect';
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


  // usa lo schema yup e hookform

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: yupResolver(schema)
  })


  const mutationCreazioneWorkspace = useMutation({
    mutationFn: async (data: {
      nomeWorkspace: string, idArea: string, idCanale: string, idPuntoVendita?: string, webpliant: any[], sitemap: any[]
    }) => {
      try {
        // Mappa idPuntoVendita a idPV per il backend MongoDB
        const payload = {
          ...data,
          idPV: data.idPuntoVendita || undefined,
          idPuntoVendita: undefined
        };
        const result = await ServerCall.put("/aggiungiWorkspaceWebPliant", payload);
        revalidator.revalidate();
        return result;
      } catch (error) {
        console.error("Errore durante la creazione del workspace:", error);
        return null;
      }
    },
    onSettled: () => {
      // Ricarica i dati
      queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onSuccess: () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Workspace creato con successo</div>
          </div>
        </div>
      );
      setShowDialog(false);
      setWorkspaceDaClonare("");
      reset();
    },
    onError: (error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante la creazione del workspace</div>
            <div className="mt-1 text-slate-500">
              {error.message}
            </div>
          </div>
        </div>
      );
      setShowDialog(false);
      reset();
    }

  });


  const mutationEliminaWorkspace = useMutation({
    mutationFn: async (data: {
      idWorkspace: string
    }) => {
      try {
        const result = await ServerCall.delete(`/eliminaWorkspaceWebPliant?id=${data.idWorkspace}`);
        revalidator.revalidate();
        return result;
      } catch (error) {
        console.error("Errore durante l'eliminazione del workspace:", error);
        return null;
      }
    },
    onSettled: () => {
      // Ricarica i dati
      queryClient.invalidateQueries({ queryKey: ['workspace'] });

    },
    onSuccess: () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Workspace eliminato con successo</div>
          </div>
        </div>
      );
      setShowDialogEliminaWorkspace(false);
      setWorkspaceDaClonare("");
    },
    onError: (error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'eliminazione del workspace</div>
            <div className="mt-1 text-slate-500">
              {error.message}
            </div>
          </div>
        </div>
      );
      setShowDialogEliminaWorkspace(false);
    }

  });

  return (
    <>
      <Dialog size="lg" centered={true} open={showDialogCreaWorkspace} onClose={() => setShowDialog(false)}>
        <Dialog.Panel>
          <Dialog.Title>Crea un nuovo workspace</Dialog.Title>
          <Dialog.Description>
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
              <div>
                <FormLabel htmlFor='workspace-name'>Nome del workspace</FormLabel>
                <FormInput
                  id='workspace-name'
                  type="text"
                  className="w-full mt-2"
                  {...register('nomeWorkspace')}
                />
                {errors.nomeWorkspace && <p className="text-red-500">{errors.nomeWorkspace.message}</p>}
              </div>
              <div className='grid grid-cols-12 gap-x-4'>
                <div className="mt-4 col-span-6">
                  <FormLabel htmlFor='workspace-area'>Area del workspace</FormLabel>
                  <FormSelect id='workspace-area' className="w-full mt-2" {...register('idArea')}>
                    <option value={""}>Scegli una area</option>
                    {aree?.map((area) => (
                      <option key={area.id} value={area.id}>{area.nome}</option>
                    ))}
                  </FormSelect>
                  {errors.idArea && <p className="text-red-500">{errors.idArea.message}</p>}
                </div>
                <div className="mt-4 col-span-6">
                  <FormLabel htmlFor='workspace-canale'>Canali del workspace</FormLabel>
                  <FormSelect id='workspace-canale' className="w-full mt-2" {...register('idCanale')}>
                    <option value={""}>Scegli una canale</option>
                    {canali?.map((canale) => (
                      <option key={canale.id} value={canale.id}>{canale.nome}</option>
                    ))}
                  </FormSelect>
                  {errors.idCanale && <p className="text-red-500">{errors.idCanale.message}</p>}
                </div>
              </div>
              <div className="mt-4">
                <FormLabel htmlFor='workspace-punto-vendita'>Punto Vendita (opzionale)</FormLabel>
                <FormSelect id='workspace-punto-vendita' className="w-full mt-2" {...register('idPuntoVendita')}>
                  <option value={""}>Scegli un punto vendita</option>
                  {puntiVendita?.map((pv) => (
                    <option key={pv.id} value={pv.id}>{pv.nome} - {pv.citta}</option>
                  ))}
                </FormSelect>
                {errors.idPuntoVendita && <p className="text-red-500">{errors.idPuntoVendita.message}</p>}
              </div>
              <Dialog.Footer>
                <Button className='mx-1' onClick={() => setShowDialog(false)} variant="secondary">
                  Annulla
                </Button>
                <Button className='mx-1' type="submit" variant="success">
                  Crea
                </Button>
              </Dialog.Footer>
            </form>
          </Dialog.Description>
        </Dialog.Panel >
      </Dialog>
      <Dialog size='lg' centered={true} open={showDialogClonaWorkspace} onClose={() => setShowDialogClonaWorkspace(false)}>
        <Dialog.Panel>
          <Dialog.Title>Clona un workspace</Dialog.Title>
          <Dialog.Description>
            <div>
              <FormLabel htmlFor='workspace-name'>Nome del workspace</FormLabel>
              <FormInput
                id='workspace-name'
                type="text"
                className="w-full mt-2"
                onChange={(e) => {
                  setNomeWorkspace(e.target.value);
                }}
                value={nomeWorkspace}
              />
            </div>
            <div className='grid grid-cols-12 gap-x-4'>
              <div className="mt-4 col-span-6">
                <FormLabel htmlFor='workspace-area'>Area del workspace</FormLabel>
                <FormSelect value={idAreaSelezionata} onChange={(e) => { setIdAreaSelezionata(e.target.value) }} id='workspace-area' className="w-full mt-2">
                  <option value={""}>Scegli una area</option>
                  {aree?.map((area) => (
                    <option key={area.id} value={area.id}>{area.nome}</option>
                  ))}
                </FormSelect>
              </div>
              <div className="mt-4 col-span-6">
                <FormLabel htmlFor='workspace-canale'>Canali del workspace</FormLabel>
                <FormSelect value={idCanaleSelezionato} onChange={(e) => { setIdCanaleSelezionato(e.target.value) }} id='workspace-canale' className="w-full mt-2">
                  <option value={""}>Scegli una canale</option>
                  {canali?.map((canale) => (
                    <option key={canale.id} value={canale.id}>{canale.nome}</option>
                  ))}
                </FormSelect>
              </div>
            </div>
            <div className="mt-4">
              <FormLabel htmlFor='workspace-punto-vendita-clona'>Punto Vendita (opzionale)</FormLabel>
              <FormSelect value={idPuntoVenditaSelezionato} onChange={(e) => { setIdPuntoVenditaSelezionato(e.target.value) }} id='workspace-punto-vendita-clona' className="w-full mt-2">
                <option value={""}>Scegli un punto vendita</option>
                {puntiVendita?.map((pv) => (
                  <option key={pv.id} value={pv.id}>{pv.nome} - {pv.citta}</option>
                ))}
              </FormSelect>
            </div>
          </Dialog.Description>
          <Dialog.Footer>
            <Button className='mx-1' onClick={() => setShowDialogClonaWorkspace(false)} variant="secondary">
              Annulla
            </Button>
            <Button className='mx-1' variant="success" onClick={() => {
              mutationCreazioneWorkspace.mutate({
                nomeWorkspace,
                idArea: idAreaSelezionata,
                idCanale: idCanaleSelezionato,
                idPuntoVendita: idPuntoVenditaSelezionato,
                webpliant: workspaces?.find((workspace) => workspace.idWorkspace === workspaceDaClonare)?.webpliant || [],
                sitemap: workspaces?.find((workspace) => workspace.idWorkspace === workspaceDaClonare)?.sitemap || []
              });
              setShowDialogClonaWorkspace(false);
            }}>
              Clona
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog size='lg' centered={true} open={showDialogEliminaWorkspace} onClose={() => setShowDialogEliminaWorkspace(false)}>
        <Dialog.Panel>
          <Dialog.Title>Elimina un workspace</Dialog.Title>
          <Dialog.Description>
            {(workspaces?.find((workspace) => workspace.idWorkspace === workspaceDaClonare)?.webpliant ?? []).length > 0 ? <>
              <div className="flex items-center p-4 my-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
                <Lucide icon="OctagonAlert" className="w-4 h-4 mr-2" />
                <span>
                  Sei sicuro di voler eliminare il workspace? Questa azione non può essere annullata. Se elimini questo workspace perderai il Webpliant
                  per <strong>{aree.find((area) => workspaces.find((w) => w.idWorkspace === workspaceDaClonare)?.idArea === area.id)?.nome}</strong>
                  e il canale <strong>{canali.find((canale) => workspaces.find((w) => w.idWorkspace === workspaceDaClonare)?.idCanale === canale.id)?.nome}</strong>
                </span>
              </div>
            </> : <>
              <div className="flex items-center p-4 my-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
                <Lucide icon="OctagonAlert" className="w-4 h-4 mr-2" />
                <span>Sei sicuro di voler eliminare il workspace? Questa azione non può essere annullata.</span>
              </div>
            </>}
          </Dialog.Description>
          <Dialog.Footer>
            <Button className='mx-1' onClick={() => setShowDialogEliminaWorkspace(false)} variant="secondary">
              Annulla
            </Button>
            <Button className='mx-1' variant="danger" onClick={() => {
              mutationEliminaWorkspace.mutate({
                idWorkspace: workspaceDaClonare
              });
              setShowDialogEliminaWorkspace(false);
            }}>
              Elimina
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
        <div className="col-span-12">
          <div className="flex flex-col mt-4 md:mt-0 md:h-10 gap-y-3 md:items-center md:flex-row">
            <PageHeader
              title="Impostazioni Webpliant"
              description="Costruisci le impostazioni per il tuo webpliant"
            />
            <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 md:ml-auto">
              <Button
                variant="primary"
                className="group-[.mode--light]:!bg-white/[0.12] group-[.mode--light]:!text-slate-200 group-[.mode--light]:!border-transparent"
                onClick={() => setShowDialog(true)}
              >
                <Lucide icon="MailPlus" className="stroke-[1.3] w-4 h-4 mr-2" />{" "}
                Crea Workspace
              </Button>
              <Button
                onClick={() => {
                  navigate('/webliant/impostazioni-webpliant/configurazione-webpliant');
                }}
                variant="primary"
                className="group-[.mode--light]:!bg-white/[0.12] group-[.mode--light]:!text-slate-200 group-[.mode--light]:!border-transparent"
              >
                <Lucide icon="Cog" className="stroke-[1.3] w-4 h-4 mr-2" /> Impostazioni
              </Button>
            </div>
          </div>
          <div className=' box box--stacked mt-6'>
            <div className="flex flex-col p-5 mb-1 sm:items-center sm:flex-row gap-y-2">
              <div>
                <div className="relative">
                  <Lucide
                    icon="Search"
                    className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                  />
                  <FormInput
                    type="text"
                    placeholder="Ricerca Workspace"
                    className="pl-9 sm:w-64 rounded-[0.5rem]"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">
                <Menu>
                  <Menu.Button
                    as={Button}
                    variant="outline-secondary"
                    className="w-full sm:w-auto"
                  >
                    <Lucide
                      icon="Download"
                      className="stroke-[1.3] w-4 h-4 mr-2"
                    />
                    Export
                    <Lucide
                      icon="ChevronDown"
                      className="stroke-[1.3] w-4 h-4 ml-2"
                    />
                  </Menu.Button>
                  <Menu.Items className="w-40">
                    <Menu.Item>
                      <Lucide icon="ChartBarIncreasing" className="w-4 h-4 mr-2" />{" "}
                      PDF
                    </Menu.Item>
                    <Menu.Item>
                      <Lucide icon="ChartBarIncreasing" className="w-4 h-4 mr-2" />
                      CSV
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
                <Popover className="inline-block">
                  {({ close }) => (
                    <>
                      <Popover.Button
                        as={Button}
                        variant="outline-secondary"
                        className="w-full sm:w-auto"
                      >
                        <Lucide
                          icon="ArrowDownWideNarrow"
                          className="stroke-[1.3] w-4 h-4 mr-2"
                        />
                        Filter
                        <div className="flex items-center justify-center h-5 px-1.5 ml-2 text-xs font-medium border rounded-full bg-slate-100">
                          3
                        </div>
                      </Popover.Button>
                      <Popover.Panel placement="bottom-end">
                        <div className="p-2">
                          <div>
                            <div className="text-left text-slate-500">
                              Uploader
                            </div>
                            <TomSelect
                              className="flex-1 mt-2"
                              options={{
                                placeholder: "Search user",
                              }} value={''} onChange={function (e: { target: { value: string | string[]; }; preventDefault: () => void; }): void {
                                throw new Error('Function not implemented.');
                              }}                                                    >

                            </TomSelect>
                          </div>
                          <div className="mt-3">
                            <div className="text-left text-slate-500">
                              File Type
                            </div>
                            <FormSelect className="flex-1 mt-2">
                              <option value="Document">Document</option>
                              <option value="Music">Music</option>
                              <option value="Video">Video</option>
                            </FormSelect>
                          </div>
                          <div className="flex items-center mt-4">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                close();
                              }}
                              className="w-32 ml-auto"
                            >
                              Close
                            </Button>
                            <Button variant="primary" className="w-32 ml-2">
                              Apply
                            </Button>
                          </div>
                        </div>
                      </Popover.Panel>
                    </>
                  )}
                </Popover>
              </div>
            </div>
            {workspaces && workspaces.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 p-6">
                {/* Workspace Card */}
                {workspaces.map((value, index) => (
                  <Link preventScrollReset target="_blank" rel="noopener noreferrer" to={`/webliant/impostazioni-webpliant/workspace?id=${value.idWorkspace}`} key={index} className="relative px-3 pt-8 pb-5 rounded-[0.6rem] border border-slate-200/80 hover:bg-slate-50 cursor-pointer transition shadow-sm">
                    <FileIcon
                      className="w-2/4 mx-auto"
                      variant="directory"
                    />
                    <div
                      className="block mt-4 font-medium text-center capitalize truncate"
                    >
                      {value.nomeWorkspace}
                    </div>
                    <div className='text-center gap-x-2 flex flex-row justify-center mt-1 flex-wrap'>
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
                      <Menu.Button
                        as="div"
                        className="block w-5 h-5"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                        }}
                      >
                        <Lucide
                          icon="EllipsisVertical"
                          className="w-5 h-5 stroke-[1] stroke-slate-400/70 fill-slate-400/70"
                        />
                      </Menu.Button>
                      <Menu.Items className="w-52">
                        <Menu.Item onClick={(e: React.MouseEvent) => { e.preventDefault(); }}>
                          <Lucide icon="Users" className="w-4 h-4 mr-2" />{" "}
                          Copia Workspace
                        </Menu.Item>
                        <Menu.Item onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          setShowDialogEliminaWorkspace(true);
                          setWorkspaceDaClonare(value.idWorkspace);
                        }} className={"text-danger"}>
                          <Lucide icon="Trash" className="w-4 h-4 mr-2" />{" "}
                          Elimina Workspace
                        </Menu.Item>
                        <Menu.Item onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          setShowDialogClonaWorkspace(true);
                          setNomeWorkspace(`${value.nomeWorkspace}_COPIA`);
                          setWorkspaceDaClonare(value.idWorkspace);
                        }}>
                          <Lucide icon="Copy" className="w-4 h-4 mr-2" />{" "}
                          Clona
                        </Menu.Item>
                      </Menu.Items>
                    </Menu>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="Workflow"
                iconColor='text-primary w-12 h-12'
                title="Nessun workspace"
                description="Non ci sono workspace disponibili"
              />
            )}
          </div>
        </div>
      </div>

    </>
  );
}

export default Main;
// export default withSessionCheck(Main);
