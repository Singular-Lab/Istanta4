import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { FormTextarea } from '@/components/Base/Form';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
import Tippy from '@/components/Base/Tippy';
import EmptyState from '@/components/EmptyState';
import { PreviewImmaginePdf } from '@/components/PreviewImmaginePdf';
import { useNotification } from '@/context/NotificationContext';
import { useMutation } from '@tanstack/react-query';
import { FC, Fragment, useEffect, useState } from 'react';
import { useLoaderData, useParams, useRevalidator } from 'react-router-dom';
import { ServerCall } from '../../../../lib/server_call';
import { FotoRicetta, ReferenzeIstanta, Ricette, STATO_RICETTA, TIPO_RICETTA } from '../../../../lib/types';

interface ModificaRicetteProps {
  ricetta?: Ricette;
}

// Type guards per ingredienti
const isLungaIngredient = (
  ingrediente: any
): ingrediente is {
  nome_prodotto: string;
  ean: string;
  quantita_necessaria: number;
  unita_misura_peso: string;
  costo_ingrediente_euro: number;
  inclusoNelVolantino: boolean;
} => {
  return 'quantita_necessaria' in ingrediente && 'costo_ingrediente_euro' in ingrediente;
};

const isCortaIngredient = (
  ingrediente: any
): ingrediente is {
  nome_prodotto: string;
  ean: string;
  peso: number;
  unita_misura_peso: string;
  costo_per_unita_misura: number;
  inclusoNelVolantino: string;
} => {
  return 'peso' in ingrediente && 'costo_per_unita_misura' in ingrediente;
};

const ModificaRicette: FC<ModificaRicetteProps> = () => {
  const { guid_id } = useParams<{ guid_id: string }>();
  const data = useLoaderData() as { ricetta: Ricette; referenze: ReferenzeIstanta[] };
  const { ricetta, referenze } = data;
  const { revalidate } = useRevalidator();
  const { showNotification } = useNotification();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const [dialogGenerazioneFoto, setDialogGenerazioneFoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMainFoto, setSelectedMainFoto] = useState<string | null>(null);
  const [expandedWineId, setExpandedWineId] = useState<string | null>(null);
  const [expandedVini, setExpandedVini] = useState<Record<number, boolean>>({});

  // Stato locale per le foto: copiamo l'array originale (in modo da preservare tutti i campi di FotoRicetta)
  const [fotoRicetta, setFotoRicetta] = useState<FotoRicetta[]>(
    (ricetta.foto_ricetta ?? []).map((f) => ({ ...f }))
  );

  useEffect(() => {
    if (ricetta.abbinamento_vino) {
      console.log(ricetta.abbinamento_vino);
    }
  }, [ricetta.foto_ricetta]);

  // Stato per il procedimento
  const [procedimento, setProcedimento] = useState(ricetta.procedimento ?? '');
  const [isEditingProcedimento, setIsEditingProcedimento] = useState(false);
  const [savingProcedimento, setSavingProcedimento] = useState(false);

  const formatTime = (seconds: string) => {
    const totalSeconds = parseInt(seconds, 10);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours > 0 ? `${hours}h ` : ''}${minutes} minuti`;
  };

  const openImagePreview = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setIsOpen(true);
  };

  const isImageLoading = (index: number) => loadingImages.has(index);

  const getIngredientDisplayInfo = (ingrediente: any) => {
    if (isLungaIngredient(ingrediente)) {
      return {
        quantity: `${ingrediente.quantita_necessaria} ${ingrediente.unita_misura_peso}`,
        cost: `€ ${ingrediente.costo_ingrediente_euro}`,
        inVolantino: ingrediente.inclusoNelVolantino,
      };
    } else if (isCortaIngredient(ingrediente)) {
      return {
        quantity: `${ingrediente.peso} ${ingrediente.unita_misura_peso}`,
        cost: `€ ${ingrediente.costo_per_unita_misura}`,
        inVolantino: ingrediente.inclusoNelVolantino === 'true',
      };
    }
    return {
      quantity: 'N/A',
      cost: 'N/A',
      inVolantino: false,
    };
  };

  // Mutation per rigenerare un'immagine già esistente
  const mutationRigeneraFoto = useMutation({
    mutationFn: async (indexFoto: number) => {
      setLoadingImages((prev) => prev.add(indexFoto));
      const response = await ServerCall.put<string>('/rigenera_foto_ricetta', {
        id: ricetta.guid_id,
        indexFoto,
      });
      return response; // nuovo URL
    },
    onSuccess: (newUrl, indexFoto) => {
      setLoadingImages((prev) => {
        prev.delete(indexFoto);
        return prev;
      });

      setFotoRicetta((prev) => {
        if (indexFoto === 0) {
          // Se stiamo rigenerando l'immagine main, la rendiamo main e togliamo main alle altre
          return prev.map((f, idx) =>
            idx === 0 ? { ...f, url: newUrl, main: true } : { ...f, main: false }
          );
        }
        // Altrimenti aggiorniamo solo l'URL senza toccare il flag main
        return prev.map((f, idx) =>
          idx === indexFoto ? { ...f, url: newUrl } : f
        );
      });
    },
    onError: (_error, indexFoto) => {
      setLoadingImages((prev) => {
        prev.delete(indexFoto);
        return prev;
      });
      showNotification('Errore durante il rinnovo della foto', { variant: 'error' });
    },
  });

  // Mutation per generare una nuova immagine (oppure sostituire un posto vuoto)
  const mutationGeneraFoto = useMutation({
    mutationFn: async (indexFoto: number) => {
      setLoadingImages((prev) => prev.add(indexFoto));
      const response = await ServerCall.put<string>('/genera_foto_ricetta', {
        id: ricetta.guid_id,
      });
      return response; // nuovo URL
    },
    onSuccess: (newUrl, indexFoto) => {
      setLoadingImages((prev) => {
        prev.delete(indexFoto);
        return prev;
      });

      setFotoRicetta((prev) => {
        // Se stiamo generando la foto main (indice 0), la impostiamo come main e togliamo main dalle altre
        if (indexFoto === 0) {
          if (prev.length > 0) {
            return prev.map((f, idx) =>
              idx === 0 ? { ...f, url: newUrl, main: true } : { ...f, main: false }
            );
          } else {
            // Se l'array era vuoto, creiamo un nuovo elemento
            return [
              { id: '', main: true, id_olimpo_cloud: '', url: newUrl, meta: null, prompt: '' },
            ];
          }
        }

        // Se l'array esiste già in quella posizione, sostituiamo l'URL mantenendo main invariato
        if (indexFoto < prev.length) {
          return prev.map((f, idx) =>
            idx === indexFoto ? { ...f, url: newUrl } : f
          );
        }

        // Se l'array è più corto, espandiamo fino a indexFoto e aggiungiamo la nuova foto con main=false
        const fillerCount = indexFoto - prev.length;
        const filler: FotoRicetta[] = Array(fillerCount).fill({
          id: '',
          main: false,
          id_olimpo_cloud: '',
          url: '',
          meta: null,
          prompt: '',
        });

        return [
          ...prev,
          ...filler,
          { id: '', main: false, id_olimpo_cloud: '', url: newUrl, meta: null, prompt: '' },
        ];
      });
    },
    onError: (_error, indexFoto) => {
      setLoadingImages((prev) => {
        prev.delete(indexFoto);
        return prev;
      });
      showNotification('Errore durante la generazione della foto', { variant: 'error' });
    },
  });

  // Mutation per aggiornare la foto principale sul server
  const mutationUpdateMainFoto = useMutation({
    mutationFn: async ({ idFoto }: { idFoto: string }) => {
      const response = await ServerCall.put('/aggiorna_foto_ricetta_a_main', {
        id: ricetta.guid_id,
        idFoto,
      });
      return response;
    },
    onSuccess: () => {
      showNotification('Foto principale aggiornata con successo', { variant: 'success' });
      revalidate();
    },
    onError: () => {
      showNotification('Errore durante l\'aggiornamento della foto principale', {
        variant: 'error',
      });
      revalidate();
    },
  });

  // Mutation per generare la ricetta approfondita
  const mutationGeneraRicettaLunga = useMutation({
    mutationFn: async () => {
      const response = await ServerCall.put<string>('/genera_ricetta_approfondita', {
        id: ricetta.guid_id,
      });
      return response;
    },
    onSuccess: () => {
      showNotification('Ricetta approfondita generata con successo', { variant: 'success' });
      revalidate();
    },
    onError: () => {
      showNotification('Errore durante la generazione della ricetta approfondita', {
        variant: 'error',
      });
      revalidate();
    },
  });

  // Mutation per aggiornare il procedimento
  const mutationUpdateProcedimento = useMutation({
    mutationFn: async (newProcedimento: string) => {
      const response = await ServerCall.put('/aggiorna_procedimento_ricetta', {
        id: ricetta.guid_id,
        procedimento: newProcedimento,
      });
      return response;
    },
    onSuccess: () => {
      showNotification('Procedimento aggiornato con successo', { variant: 'success' });
      setIsEditingProcedimento(false);
      setSavingProcedimento(false);
      revalidate();
    },
    onError: () => {
      showNotification('Errore durante l\'aggiornamento del procedimento', {
        variant: 'error',
      });
      setSavingProcedimento(false);
    },
  });

  const mutationGeneraAbbinamentoVino = useMutation({
    mutationFn: async () => {
      const response = await ServerCall.put('/genera_abbinamento_vino', {
        id: ricetta.guid_id,
      });
      return response;
    },
    onSuccess: () => {
      showNotification('Abbinamento vino generato con successo', { variant: 'success' });
      revalidate();
    },
    onError: () => {
      showNotification('Errore durante la generazione dell\'abbinamento vino', { variant: 'error' });
    },
  });

  const saveProcedimento = () => {
    setSavingProcedimento(true);
    mutationUpdateProcedimento.mutate(procedimento);
  };

  // Calcoliamo mainImage e otherImages a partire da stato locale
  const mainImage = fotoRicetta.find((f) => f.main)?.url;
  const otherImages = fotoRicetta.filter((f) => !f.main);

  return (
    <Fragment>
      <Dialog
        open={dialogGenerazioneFoto}
        onClose={() => {
          if (!loading) setDialogGenerazioneFoto(false);
        }}
      >
        <Dialog.Panel>
          <Dialog.Title className="text-lg font-semibold">Generazione foto</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-gray-600">
            Questa operazione potrebbe richiedere molto tempo. Per favore non chiudere la pagina finché non termina.
          </Dialog.Description>
          <Dialog.Footer className="mt-4 flex justify-end gap-2">
            <Button
              variant="primary"
              onClick={() => mutationGeneraFoto.mutate(0)}
              disabled={mutationGeneraFoto.isPending}
            >
              {loading ? (
                <>
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                'Genera foto'
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setDialogGenerazioneFoto(false)}
              disabled={loading}
            >
              Annulla
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <div className="flex-1">
        {/* Titolo Ricetta */}
        <PageHeader title={ricetta.titolo!} />

        {/* Sezione Foto Principale e Galleria */}
        {ricetta.tipo === TIPO_RICETTA.LUNGA && (
          <Fragment>
            <div className="box box--stacked mb-6">
              <div className="p-6">
                <h2 className="text-xl font-bold mb-4">Galleria Foto</h2>

                {/* Foto Principale */}
                <div className="relative h-96 mb-6 rounded-sm">
                  {mainImage ? (
                    <Fragment>
                      <div className="relative w-full h-full">
                        <img
                          src={mainImage}
                          alt={ricetta.titolo}
                          className="w-full h-full object-cover rounded-lg"
                        />

                        {/* Overlay di caricamento per foto principale */}
                        {isImageLoading(0) && (
                          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                            <div className="text-center text-white">
                              <Lucide icon="Loader" className="w-8 h-8 animate-spin mx-auto mb-2" />
                              <p className="text-sm">Rigenerando foto...</p>
                            </div>
                          </div>
                        )}

                        <div className="absolute bottom-4 right-4 z-50 flex items-center justify-center">
                          <Button
                            variant="secondary"
                            onClick={() => openImagePreview(mainImage)}
                            disabled={isImageLoading(0)}
                          >
                            <Lucide icon="ZoomIn" className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="primary"
                            className="ml-2"
                            onClick={() => setDialogGenerazioneFoto(true)}
                            disabled={isImageLoading(0)}
                          >
                            <Lucide
                              icon={isImageLoading(0) ? 'Loader' : 'RefreshCw'}
                              className={`w-4 h-4 ${isImageLoading(0) ? 'animate-spin' : ''}`}
                            />
                          </Button>
                        </div>
                      </div>
                    </Fragment>
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-lg">
                      {isImageLoading(0) ? (
                        <div className="text-center">
                          <Lucide icon="Loader" className="w-8 h-8 animate-spin mx-auto mb-2" />
                          <p className="text-sm text-gray-600">Generando foto...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-gray-400">Nessuna immagine disponibile</span>
                          <Button
                            variant="primary"
                            className="m-2"
                            onClick={() => mutationGeneraFoto.mutate(0)}
                          >
                            <Lucide icon="ImagePlus" className="w-4 h-4" />
                            &nbsp;Crea immagine
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 my-4">
              {otherImages.map((foto, index) => (
                <div key={index} className="relative aspect-square p-4 box box--stacked">
                  <img
                    src={foto.url}
                    alt={`Foto ricetta ${index + 1}`}
                    className="w-full h-full object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => openImagePreview(foto.url)}
                  />

                  {/* Overlay di caricamento per foto secondarie */}
                  {isImageLoading(index) && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded">
                      <Lucide icon="Loader" className="w-3 h-3 animate-spin text-white" />
                    </div>
                  )}

                  <div className="absolute top-0 right-0">
                    <Tippy
                      content="Rigenera foto"
                      as={Button}
                      variant="soft-primary"
                      className="m-2"
                      onClick={() => mutationRigeneraFoto.mutate(index)}
                      disabled={isImageLoading(index)}
                    >
                      <Lucide
                        icon={isImageLoading(index) ? 'Loader' : 'RefreshCw'}
                        className={`w-3 h-3 ${isImageLoading(index) ? 'animate-spin' : ''}`}
                      />
                    </Tippy>
                    <Tippy
                      content="Imposta come principale"
                      as={Button}
                      variant="secondary"
                      className="m-2"
                      onClick={() => mutationUpdateMainFoto.mutate({ idFoto: foto.id })}
                      disabled={mutationUpdateMainFoto.isPending}
                    >
                      <Lucide
                        icon={mutationUpdateMainFoto.isPending ? 'Loader' : 'Star'}
                        className={`w-3 h-3 ${mutationUpdateMainFoto.isPending ? 'animate-spin' : ''
                          }`}
                      />
                    </Tippy>
                  </div>
                </div>
              ))}

              {(otherImages.length < 8 && (otherImages.length > 0 || mainImage !== undefined)) && (
                <div className="text-center p-2 box box--stacked aspect-square mb-2">
                  {isImageLoading(otherImages.length) ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center h-full w-full bg-gray-100">
                      <Lucide icon="Loader" className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center h-full w-full bg-gray-100">
                      <Lucide
                        icon="ImagePlus"
                        className="w-6 h-6 cursor-pointer"
                        onClick={() => mutationGeneraFoto.mutate(otherImages.length)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </Fragment>
        )}

        {/* Preview Immagine */}
        {isOpen && ricetta.tipo === TIPO_RICETTA.LUNGA && (
          <PreviewImmaginePdf
            imageUrl={selectedImageUrl || mainImage || ''}
            onClose={() => setIsOpen(false)}
            totalPages={1}
          />
        )}

        {/* Sezione Informazioni Base */}
        <div className="box box--stacked mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <Lucide icon="Info" className="w-5 h-5 mr-2 text-primary" />
              Informazioni Base
            </h2>
            <div className="flex flex-wrap gap-4 text-gray-600 items-center">

              {ricetta.tempo_in_secondi && (
                <span className="flex items-center">
                  <Lucide icon="Clock" className="w-4 h-4 mr-2 text-slate-500" />
                  {formatTime(ricetta.tempo_in_secondi)}
                </span>
              )}
              {ricetta.costo_in_euro && (
                <span className="flex items-center">
                  <Lucide icon="Euro" className="w-4 h-4 mr-2 text-slate-500" />
                  {ricetta.costo_in_euro} €
                </span>
              )}
              <Badge
                border
                variant={ricetta.tipo === TIPO_RICETTA.LUNGA ? 'primary' : 'secondary'}
              >
                {ricetta.tipo === TIPO_RICETTA.LUNGA
                  ? 'Ricetta approfondita'
                  : 'Ricetta non approfondita'}
              </Badge>
              {(() => {
                switch (ricetta.stato) {
                  case STATO_RICETTA.PUBBLICARE:
                    return (
                      <Badge border variant="success">
                        Al momento pubblicata
                      </Badge>
                    );
                  case STATO_RICETTA.REVISIONARE:
                    return (
                      <Badge border variant="warning">
                        In attesa di revisione
                      </Badge>
                    );
                  default:
                    return null;
                }
              })()}
              {ricetta.tipo !== TIPO_RICETTA.LUNGA && (
                <Button className="ml-auto"
                  variant="primary"
                  onClick={() => mutationGeneraRicettaLunga.mutate()}
                  disabled={mutationGeneraRicettaLunga.isPending}
                >
                  {mutationGeneraRicettaLunga.isPending ? (
                    <>
                      <Lucide icon="Loader" className="w-4 h-4 animate-spin mr-2" />
                      Generazione in corso...
                    </>
                  ) : (
                    <>
                      <Lucide icon="Wand" className="w-4 h-4 mr-2" />
                      Genera ricetta approfondita
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sezione Ingredienti */}
        <div className="box box--stacked mb-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
              <Lucide icon="ChefHat" className="w-5 h-5 mr-2 text-primary" />
              Ingredienti
            </h2>
            <ul className="space-y-3">
              {ricetta.ingredienti?.map((ingrediente, index) => {
                const ref = referenze.find(
                  (r) => r.dataFields.codice_referenza === ingrediente.ean
                );
                const displayInfo = getIngredientDisplayInfo(ingrediente);

                return (
                  <li key={index} className="flex flex-col p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <span className="font-medium">{ingrediente.nome_prodotto}</span>
                        <span className="text-sm text-gray-500 block">
                          EAN: {ingrediente.ean}
                        </span>
                        {ref && (
                          <Fragment>
                            <div className="flex items-center mt-1">
                              {ref.foto && (
                                <img
                                  src={ref.foto[0]}
                                  alt="Referenza"
                                  className="w-8 h-8 rounded mr-2 object-cover"
                                />
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {ref.dataFields.descrizione_uno}{' '}
                              {ref.dataFields.descrizione_due}{' '}
                              {ref.dataFields.descrizione_tre}{' '}
                              {ref.dataFields.descrizione_peso}{' '}
                              {ref.dataFields.descrizione_unita_misura}
                            </div>
                          </Fragment>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <span className="font-medium block">{displayInfo.quantity}</span>
                        <span className="text-sm text-gray-500 block">{displayInfo.cost}</span>
                        {displayInfo.inVolantino && (
                          <Badge variant="success" className="text-xs mt-1">
                            In volantino
                          </Badge>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Sezione Procedimento */}
        {ricetta.procedimento && (
          <div className="box box--stacked mb-6">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <Lucide icon="ListOrdered" className="w-5 h-5 mr-2 text-primary" />
                  Procedimento
                </h2>
                {isEditingProcedimento ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={saveProcedimento}
                      disabled={savingProcedimento}
                    >
                      {savingProcedimento ? (
                        <>
                          <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Lucide icon="Save" className="w-4 h-4 mr-2" />
                          Salva
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline-secondary"
                      onClick={() => {
                        setProcedimento(ricetta.procedimento ?? '');
                        setIsEditingProcedimento(false);
                      }}
                      disabled={savingProcedimento}
                    >
                      <Lucide icon="X" className="w-4 h-4 mr-2" />
                      Annulla
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline-primary"
                    onClick={() => setIsEditingProcedimento(true)}
                  >
                    <Lucide icon="Pen" className="w-4 h-4 mr-2" />
                    Modifica
                  </Button>
                )}
              </div>
              {isEditingProcedimento ? (
                <FormTextarea
                  className="w-full h-64 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  value={procedimento}
                  onChange={(e) => setProcedimento(e.target.value)}
                  disabled={savingProcedimento}
                  placeholder="Inserisci il procedimento della ricetta..."
                />
              ) : (
                <div className="prose max-w-none text-sm">
                  {ricetta.procedimento?.split('\n').map((step, idx) => (
                    <p key={idx} className="mb-1">
                      {step}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sezione Abbinamento Vino */}
        {ricetta.abbinamento_vino && ricetta.abbinamento_vino.vini_abbinati && ricetta.abbinamento_vino.vini_abbinati.length > 0 ? (
          <div className="box box--stacked mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <Lucide icon="Wine" className="w-5 h-5 mr-2 text-purple-500" />
                  Abbinamento Vino
                </h2>
                <Button
                  variant="outline-primary"
                  onClick={() => mutationGeneraAbbinamentoVino.mutate()}
                  disabled={mutationGeneraAbbinamentoVino.isPending}
                  size="sm"
                >
                  {mutationGeneraAbbinamentoVino.isPending ? (
                    <>
                      <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                      Rigenerando...
                    </>
                  ) : (
                    <>
                      <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
                      Rigenera
                    </>
                  )}
                </Button>
              </div>

              {/* Motivazione abbinamento */}
              {ricetta.abbinamento_vino.motivazione && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-medium text-slate-800 mb-2">Motivazione dell'abbinamento</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {ricetta.abbinamento_vino.motivazione}
                  </p>
                </div>
              )}

              {/* Lista vini abbinati */}
              <div className="space-y-3">
                <h3 className="font-medium text-slate-800">Vini consigliati</h3>
                <div className="grid grid-cols-1 gap-3">
                  {ricetta.abbinamento_vino.vini_abbinati.map((vinoCode, index) => (
                    <div key={index} className="border border-slate-200 rounded-lg overflow-hidden mb-2">
                      <div
                        className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => {
                          // Toggle expanded state for this vino
                          const newExpandedItems = { ...expandedVini };
                          newExpandedItems[index] = !newExpandedItems[index];
                          setExpandedVini(newExpandedItems);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            {typeof vinoCode !== 'string' && (
                              <img
                                src={vinoCode.foto[0]}
                                alt={vinoCode.approfondimento.nome}
                                className="w-full h-full object-cover"
                              />
                            )}
                            {typeof vinoCode === 'string' && (
                              <Lucide icon="Wine" className="w-4 h-4 text-purple-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">
                              {typeof vinoCode === 'string'
                                ? `Vino codice: ${vinoCode}`
                                : `${vinoCode.approfondimento.nome} - ${vinoCode.approfondimento.cantina}`}
                            </p>
                            <p className="text-sm text-slate-500">
                              {expandedVini[index] ? 'Clicca per nascondere i dettagli' : 'Clicca per visualizzare i dettagli'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Lucide
                            icon={expandedVini[index] ? "ChevronUp" : "ChevronDown"}
                            className="w-4 h-4 text-slate-500"
                          />
                        </div>
                      </div>

                      {/* Contenuto espandibile */}
                      {expandedVini[index] && typeof vinoCode !== 'string' && (
                        <div className="p-4 bg-slate-50 border-t border-slate-200">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {vinoCode.approfondimento.cantina && (
                              <div>
                                <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Cantina</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.cantina}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.anno && (
                              <div>
                                <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Anno</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.anno}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.provenienza && (
                              <div>
                                <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Provenienza</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.provenienza}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.colore && (
                              <div>
                                <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Colore</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.colore}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.tasso_alcolico && (
                              <div>
                                <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Tasso alcolico</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.tasso_alcolico}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.temperatura_di_servizio && (
                              <div>
                                <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Temperatura di servizio</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.temperatura_di_servizio}</p>
                              </div>
                            )}
                          </div>

                          {/* Descrizioni più lunghe */}
                          {(vinoCode.approfondimento.profumo || vinoCode.approfondimento.gusto || vinoCode.approfondimento.abbinamenti || vinoCode.approfondimento.dettagli_cantina) && (
                            <div className="mt-4 space-y-3">
                              {vinoCode.approfondimento.profumo && (
                                <div>
                                  <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Profumo</h4>
                                  <p className="text-sm text-slate-800">{vinoCode.approfondimento.profumo}</p>
                                </div>
                              )}
                              {vinoCode.approfondimento.gusto && (
                                <div>
                                  <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Gusto</h4>
                                  <p className="text-sm text-slate-800">{vinoCode.approfondimento.gusto}</p>
                                </div>
                              )}
                              {vinoCode.approfondimento.abbinamenti && (
                                <div>
                                  <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Abbinamenti consigliati</h4>
                                  <p className="text-sm text-slate-800">{vinoCode.approfondimento.abbinamenti}</p>
                                </div>
                              )}
                              {vinoCode.approfondimento.dettagli_cantina && (
                                <div>
                                  <h4 className="text-xs uppercase text-slate-500 font-medium mb-1">Dettagli cantina</h4>
                                  <p className="text-sm text-slate-800">{vinoCode.approfondimento.dettagli_cantina}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-4 flex justify-end">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => {
                                console.log('Visualizza dettagli completi vino:', vinoCode);
                              }}
                            >
                              <Lucide icon="ExternalLink" className="w-4 h-4 mr-1" />
                              Vedi scheda completa
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Per vini con solo codice string */}
                      {expandedVini[index] && typeof vinoCode === 'string' && (
                        <div className="p-4 bg-slate-50 border-t border-slate-200">
                          <p className="text-sm text-slate-600 mb-2">Informazioni dettagliate non disponibili per questo vino.</p>
                          <div className="flex justify-end">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => {
                                console.log('Visualizza dettagli vino con codice:', vinoCode);
                              }}
                            >
                              <Lucide icon="ExternalLink" className="w-4 h-4 mr-1" />
                              Cerca informazioni
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="box box--stacked mb-6">
            <div className="p-6">
              {mutationGeneraAbbinamentoVino.isPending ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="flex items-center mb-4">
                    <Lucide icon="Loader" className="w-8 h-8 text-purple-500 animate-spin mr-3" />
                    <span className="text-lg font-medium text-slate-700">Generazione abbinamento in corso...</span>
                  </div>
                  <p className="text-sm text-slate-500 text-center max-w-md">
                    Stiamo analizzando gli ingredienti della ricetta per trovare i vini più adatti. Questo processo potrebbe richiedere alcuni minuti.
                  </p>
                </div>
              ) : (
                <EmptyState
                  icon="Wine"
                  title="Nessun abbinamento vino disponibile"
                  description="Non è stato ancora creato un abbinamento vino per questa ricetta. Genera un abbinamento personalizzato basato sugli ingredienti e le caratteristiche del piatto."
                  buttonText="Genera abbinamento vino"
                  onButtonClick={() => mutationGeneraAbbinamentoVino.mutate()}
                  iconColor="text-purple-500"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
};

export default ModificaRicette;
