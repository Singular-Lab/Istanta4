import Button from '@/components/Base/Button';
import { FormTextarea } from '@/components/Base/Form';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import Spinner from '@/components/Base/Spinner';
import StatusBadge from '@/components/Base/StatusBadge';
import Tippy from '@/components/Base/Tippy';
import EmptyState from '@/components/EmptyState';
import { PreviewImmaginePdf } from '@/components/PreviewImmaginePdf';
import { useNotification } from '@/context/NotificationContext';
import { useMutation } from '@tanstack/react-query';
import { FC, Fragment, useState } from 'react';
import { useLoaderData, useParams, useRevalidator } from 'react-router-dom';
import { ServerCall } from '../../../../lib/server_call';
import { FotoRicetta, ReferenzeIstanta, Ricette, STATO_RICETTA, TIPO_RICETTA } from '../../../../lib/types';
import { urlFoto } from '@/utils/helper';

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
    (ricetta?.foto_ricetta ?? []).map((f) => ({ ...f }))
  );

  // Stato per il procedimento
  const [procedimento, setProcedimento] = useState(ricetta?.procedimento ?? '');
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
  const indietro = { to: '/gestione-ricette', etichetta: 'Torna alle ricette' };

  // Il caricamento della pagina non ha restituito la ricetta: errore, non una pagina vuota
  if (!ricetta) {
    return (
      <Pagina titolo="Ricetta" indietro={indietro}>
        <Sezione>
          <PageError
            compatta
            titolo="Ricetta non caricata"
            motivo="Non è stato possibile recuperare la ricetta."
            onRiprova={() => revalidate()}
          />
        </Sezione>
      </Pagina>
    );
  }

  return (
    <Fragment>
      <Dialog
        open={dialogGenerazioneFoto}
        onClose={() => {
          if (!loading) setDialogGenerazioneFoto(false);
        }}
      >
        <Dialog.Panel>
          <Dialog.Title>Generazione foto</Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">
            Questa operazione potrebbe richiedere molto tempo. Per favore non chiudere la pagina finché non termina.
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => setDialogGenerazioneFoto(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={() => mutationGeneraFoto.mutate(0)}
              disabled={mutationGeneraFoto.isPending}
              loading={loading}
            >
              Genera foto
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <Pagina titolo={ricetta.titolo!} descrizione="Dettaglio della ricetta generata" indietro={indietro}>
        {/* Sezione Foto Principale e Galleria */}
        {ricetta.tipo === TIPO_RICETTA.LUNGA && (
          <Sezione titolo="Galleria Foto" icona="Image">
            {/* Foto Principale */}
            <div className="relative h-96">
              {mainImage ? (
                <div className="relative h-full w-full">
                  <img
                    src={mainImage}
                    alt={ricetta.titolo}
                    className="h-full w-full rounded-card object-cover"
                  />

                  {/* Overlay di caricamento per foto principale */}
                  {isImageLoading(0) && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-card bg-black/50">
                      <div role="status" className="text-center text-white">
                        <Spinner size="lg" decorativo className="mx-auto mb-2 text-white" />
                        <p className="text-sm">Rigenerando foto...</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => openImagePreview(mainImage)}
                      disabled={isImageLoading(0)}
                      aria-label="Ingrandisci foto principale"
                    >
                      <Lucide icon="ZoomIn" aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => setDialogGenerazioneFoto(true)}
                      disabled={isImageLoading(0)}
                      aria-label="Rigenera foto principale"
                      aria-busy={isImageLoading(0)}
                    >
                      {isImageLoading(0)
                        ? <Spinner size="sm" decorativo className="text-current" />
                        : <Lucide icon="RefreshCw" aria-hidden="true" className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-card bg-slate-100">
                  {isImageLoading(0) ? (
                    <div role="status" className="text-center">
                      <Spinner size="lg" decorativo className="mx-auto mb-2" />
                      <p className="text-sm text-slate-600">Generando foto...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="text-slate-500">Nessuna immagine disponibile</span>
                      <Button
                        variant="primary"
                        onClick={() => mutationGeneraFoto.mutate(0)}
                      >
                        <Lucide icon="ImagePlus" aria-hidden="true" className="mr-2 h-4 w-4" />
                        Crea immagine
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {(otherImages.length > 0 || (otherImages.length < 8 && mainImage !== undefined)) && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {otherImages.map((foto, index) => (
                  <div key={index} className="relative aspect-square rounded-card border border-slate-200 bg-white p-2">
                    <button
                      type="button"
                      className="block h-full w-full"
                      onClick={() => openImagePreview(foto.url)}
                      aria-label={`Ingrandisci foto ${index + 1}`}
                    >
                      <img
                        src={foto.url}
                        alt={`Foto ricetta ${index + 1}`}
                        className="h-full w-full cursor-pointer rounded-control object-cover transition-opacity hover:opacity-80"
                      />
                    </button>

                    {/* Overlay di caricamento per foto secondarie */}
                    {isImageLoading(index) && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-card bg-black/50">
                        <Spinner size="sm" etichetta="Rigenerazione foto in corso…" className="text-white" />
                      </div>
                    )}

                    <div className="absolute right-3 top-3 flex gap-1">
                      <Tippy
                        content="Rigenera foto"
                        as={Button}
                        variant="secondary"
                        size="sm"
                        onClick={() => mutationRigeneraFoto.mutate(index)}
                        disabled={isImageLoading(index)}
                        aria-label={`Rigenera foto ${index + 1}`}
                      >
                        {isImageLoading(index)
                          ? <Spinner size="sm" decorativo className="h-3.5 w-3.5 text-current" />
                          : <Lucide icon="RefreshCw" aria-hidden="true" className="h-3.5 w-3.5" />}
                      </Tippy>
                      <Tippy
                        content="Imposta come principale"
                        as={Button}
                        variant="secondary"
                        size="sm"
                        onClick={() => mutationUpdateMainFoto.mutate({ idFoto: foto.id })}
                        disabled={mutationUpdateMainFoto.isPending}
                        aria-label={`Imposta foto ${index + 1} come principale`}
                      >
                        {mutationUpdateMainFoto.isPending
                          ? <Spinner size="sm" decorativo className="h-3.5 w-3.5 text-current" />
                          : <Lucide icon="Star" aria-hidden="true" className="h-3.5 w-3.5" />}
                      </Tippy>
                    </div>
                  </div>
                ))}

                {(otherImages.length < 8 && (otherImages.length > 0 || mainImage !== undefined)) && (
                  <div className="aspect-square">
                    {isImageLoading(otherImages.length) ? (
                      <div className="flex h-full w-full items-center justify-center rounded-card border-2 border-dashed border-slate-300 bg-slate-50">
                        <Spinner etichetta="Generazione foto in corso…" />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex h-full w-full items-center justify-center rounded-card border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:bg-slate-100"
                        onClick={() => mutationGeneraFoto.mutate(otherImages.length)}
                        aria-label="Genera una nuova foto"
                      >
                        <Lucide icon="ImagePlus" aria-hidden="true" className="h-6 w-6" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Sezione>
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
        <Sezione
          titolo="Informazioni Base"
          icona="Info"
          azioni={
            ricetta.tipo !== TIPO_RICETTA.LUNGA ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => mutationGeneraRicettaLunga.mutate()}
                loading={mutationGeneraRicettaLunga.isPending}
              >
                {!mutationGeneraRicettaLunga.isPending && <Lucide icon="Wand" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                Genera ricetta approfondita
              </Button>
            ) : undefined
          }
        >
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            {ricetta.tempo_in_secondi && (
              <span className="flex items-center">
                <Lucide icon="Clock" aria-hidden="true" className="mr-2 h-4 w-4 text-slate-500" />
                {formatTime(ricetta.tempo_in_secondi)}
              </span>
            )}
            {ricetta.costo_in_euro && (
              <span className="flex items-center">
                <Lucide icon="Euro" aria-hidden="true" className="mr-2 h-4 w-4 text-slate-500" />
                {ricetta.costo_in_euro} €
              </span>
            )}
            <StatusBadge
              tono={ricetta.tipo === TIPO_RICETTA.LUNGA ? 'brand' : 'neutral'}
              etichetta={ricetta.tipo === TIPO_RICETTA.LUNGA ? 'Ricetta approfondita' : 'Ricetta non approfondita'}
            />
            {(() => {
              switch (ricetta.stato) {
                case STATO_RICETTA.PUBBLICARE:
                  return <StatusBadge tono="success" etichetta="Al momento pubblicata" />;
                case STATO_RICETTA.REVISIONARE:
                  return <StatusBadge tono="warning" etichetta="In attesa di revisione" />;
                default:
                  return null;
              }
            })()}
          </div>
        </Sezione>

        {/* Sezione Ingredienti */}
        <Sezione titolo="Ingredienti" icona="ChefHat">
          {ricetta.ingredienti && ricetta.ingredienti.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {ricetta.ingredienti.map((ingrediente, index) => {
                const ref = (referenze ?? []).find(
                  (r) => r.dataFields.codice_referenza === ingrediente.ean
                );
                const displayInfo = getIngredientDisplayInfo(ingrediente);

                return (
                  <li key={index} className="flex flex-col rounded-control bg-slate-50 p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="font-medium text-slate-800">{ingrediente.nome_prodotto}</span>
                        <span className="block text-sm text-slate-500">
                          EAN: {ingrediente.ean}
                        </span>
                        {ref && (
                          <Fragment>
                            {ref.foto && (
                              <div className="mt-1 flex items-center">
                                <img
                                  src={urlFoto(ref.foto)[0]}
                                  alt="Referenza"
                                  className="mr-2 h-8 w-8 rounded-control object-cover"
                                />
                              </div>
                            )}
                            <div className="text-xs text-slate-500">
                              {ref.dataFields.descrizione_uno}{' '}
                              {ref.dataFields.descrizione_due}{' '}
                              {ref.dataFields.descrizione_tre}{' '}
                              {ref.dataFields.descrizione_peso}{' '}
                              {ref.dataFields.descrizione_unita_misura}
                            </div>
                          </Fragment>
                        )}
                      </div>
                      <div className="ml-4 text-right">
                        <span className="block font-medium tabular-nums text-slate-800">{displayInfo.quantity}</span>
                        <span className="block text-sm tabular-nums text-slate-500">{displayInfo.cost}</span>
                        {displayInfo.inVolantino && (
                          <StatusBadge tono="success" etichetta="In volantino" className="mt-1" />
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState compatta icon="ChefHat" title="Nessun ingrediente" description="La ricetta non ha ingredienti." />
          )}
        </Sezione>

        {/* Sezione Procedimento */}
        {ricetta.procedimento && (
          <Sezione
            titolo="Procedimento"
            icona="ListOrdered"
            azioni={
              isEditingProcedimento ? (
                <>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => {
                      setProcedimento(ricetta.procedimento ?? '');
                      setIsEditingProcedimento(false);
                    }}
                    disabled={savingProcedimento}
                  >
                    Annulla
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={saveProcedimento}
                    loading={savingProcedimento}
                  >
                    {!savingProcedimento && <Lucide icon="Save" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                    Salva
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => setIsEditingProcedimento(true)}
                >
                  <Lucide icon="Pen" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Modifica
                </Button>
              )
            }
          >
            {isEditingProcedimento ? (
              <FormTextarea
                aria-label="Procedimento"
                className="h-64 w-full"
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
          </Sezione>
        )}

        {/* Sezione Abbinamento Vino */}
        {ricetta.abbinamento_vino && ricetta.abbinamento_vino.vini_abbinati && ricetta.abbinamento_vino.vini_abbinati.length > 0 ? (
          <Sezione
            titolo="Abbinamento Vino"
            icona="Wine"
            azioni={
              <Button
                variant="outline-secondary"
                onClick={() => mutationGeneraAbbinamentoVino.mutate()}
                loading={mutationGeneraAbbinamentoVino.isPending}
                size="sm"
              >
                {!mutationGeneraAbbinamentoVino.isPending && <Lucide icon="RefreshCw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />}
                Rigenera
              </Button>
            }
          >
            {/* Motivazione abbinamento */}
            {ricetta.abbinamento_vino.motivazione && (
              <div className="mb-5 rounded-card bg-slate-50 p-4">
                <h3 className="title-card mb-2">Motivazione dell'abbinamento</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {ricetta.abbinamento_vino.motivazione}
                </p>
              </div>
            )}

            {/* Lista vini abbinati */}
            <div className="flex flex-col gap-3">
              <h3 className="title-card">Vini consigliati</h3>
              <div className="grid grid-cols-1 gap-3">
                {ricetta.abbinamento_vino.vini_abbinati.map((vinoCode, index) => (
                  <div key={index} className="overflow-hidden rounded-card border border-slate-200">
                    <button
                      type="button"
                      aria-expanded={!!expandedVini[index]}
                      className="flex w-full cursor-pointer items-center justify-between bg-white p-3 text-left transition-colors hover:bg-slate-50"
                      onClick={() => {
                        // Toggle expanded state for this vino
                        const newExpandedItems = { ...expandedVini };
                        newExpandedItems[index] = !newExpandedItems[index];
                        setExpandedVini(newExpandedItems);
                      }}
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                          {typeof vinoCode !== 'string' && (
                            <img
                              src={urlFoto(vinoCode.foto)[0]}
                              alt={vinoCode.approfondimento.nome}
                              className="h-full w-full object-cover"
                            />
                          )}
                          {typeof vinoCode === 'string' && (
                            <Lucide icon="Wine" aria-hidden="true" className="h-4 w-4 text-primary" />
                          )}
                        </span>
                        <span className="block">
                          <span className="block font-medium text-slate-800">
                            {typeof vinoCode === 'string'
                              ? `Vino codice: ${vinoCode}`
                              : `${vinoCode.approfondimento.nome} - ${vinoCode.approfondimento.cantina}`}
                          </span>
                          <span className="block text-sm text-slate-500">
                            {expandedVini[index] ? 'Clicca per nascondere i dettagli' : 'Clicca per visualizzare i dettagli'}
                          </span>
                        </span>
                      </span>
                      <Lucide
                        icon={expandedVini[index] ? "ChevronUp" : "ChevronDown"}
                        aria-hidden="true"
                        className="h-4 w-4 text-slate-500"
                      />
                    </button>

                    {/* Contenuto espandibile */}
                    {expandedVini[index] && typeof vinoCode !== 'string' && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {vinoCode.approfondimento.cantina && (
                            <div>
                              <h4 className="title-eyebrow mb-1">Cantina</h4>
                              <p className="text-sm text-slate-800">{vinoCode.approfondimento.cantina}</p>
                            </div>
                          )}
                          {vinoCode.approfondimento.anno && (
                            <div>
                              <h4 className="title-eyebrow mb-1">Anno</h4>
                              <p className="text-sm text-slate-800">{vinoCode.approfondimento.anno}</p>
                            </div>
                          )}
                          {vinoCode.approfondimento.provenienza && (
                            <div>
                              <h4 className="title-eyebrow mb-1">Provenienza</h4>
                              <p className="text-sm text-slate-800">{vinoCode.approfondimento.provenienza}</p>
                            </div>
                          )}
                          {vinoCode.approfondimento.colore && (
                            <div>
                              <h4 className="title-eyebrow mb-1">Colore</h4>
                              <p className="text-sm text-slate-800">{vinoCode.approfondimento.colore}</p>
                            </div>
                          )}
                          {vinoCode.approfondimento.tasso_alcolico && (
                            <div>
                              <h4 className="title-eyebrow mb-1">Tasso alcolico</h4>
                              <p className="text-sm text-slate-800">{vinoCode.approfondimento.tasso_alcolico}</p>
                            </div>
                          )}
                          {vinoCode.approfondimento.temperatura_di_servizio && (
                            <div>
                              <h4 className="title-eyebrow mb-1">Temperatura di servizio</h4>
                              <p className="text-sm text-slate-800">{vinoCode.approfondimento.temperatura_di_servizio}</p>
                            </div>
                          )}
                        </div>

                        {/* Descrizioni più lunghe */}
                        {(vinoCode.approfondimento.profumo || vinoCode.approfondimento.gusto || vinoCode.approfondimento.abbinamenti || vinoCode.approfondimento.dettagli_cantina) && (
                          <div className="mt-4 flex flex-col gap-3">
                            {vinoCode.approfondimento.profumo && (
                              <div>
                                <h4 className="title-eyebrow mb-1">Profumo</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.profumo}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.gusto && (
                              <div>
                                <h4 className="title-eyebrow mb-1">Gusto</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.gusto}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.abbinamenti && (
                              <div>
                                <h4 className="title-eyebrow mb-1">Abbinamenti consigliati</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.abbinamenti}</p>
                              </div>
                            )}
                            {vinoCode.approfondimento.dettagli_cantina && (
                              <div>
                                <h4 className="title-eyebrow mb-1">Dettagli cantina</h4>
                                <p className="text-sm text-slate-800">{vinoCode.approfondimento.dettagli_cantina}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Per vini con solo codice string */}
                    {expandedVini[index] && typeof vinoCode === 'string' && (
                      <div className="border-t border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600">Informazioni dettagliate non disponibili per questo vino.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Sezione>
        ) : (
          <Sezione titolo="Abbinamento Vino" icona="Wine">
            {mutationGeneraAbbinamentoVino.isPending ? (
              <div role="status" className="flex flex-col items-center justify-center py-12">
                <div className="mb-4 flex items-center">
                  <Spinner size="lg" decorativo className="mr-3" />
                  <span className="text-lg font-medium text-slate-700">Generazione abbinamento in corso...</span>
                </div>
                <p className="max-w-md text-center text-sm text-slate-500">
                  Stiamo analizzando gli ingredienti della ricetta per trovare i vini più adatti. Questo processo potrebbe richiedere alcuni minuti.
                </p>
              </div>
            ) : (
              <EmptyState
                compatta
                icon="Wine"
                title="Nessun abbinamento vino disponibile"
                description="Non è stato ancora creato un abbinamento vino per questa ricetta. Genera un abbinamento personalizzato basato sugli ingredienti e le caratteristiche del piatto."
                buttonText="Genera abbinamento vino"
                buttonIcon="Sparkles"
                onButtonClick={() => mutationGeneraAbbinamentoVino.mutate()}
              />
            )}
          </Sezione>
        )}
      </Pagina>
    </Fragment>
  );
};

export default ModificaRicette;
