import Button from '@/components/Base/Button';
import { FormField, FormInput, FormLabel } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Pagina from '@/components/Base/Pagina';
import Sezione from '@/components/Base/Sezione';
import Skeleton from '@/components/Base/Skeleton';
import StatusBadge from '@/components/Base/StatusBadge';
import { useNotification } from '@/context/NotificationContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ServerCall } from '../../../../lib/server_call';
import { ApprofondimentoVino, ReferenzeIstanta } from '../../../../lib/types';
import { urlFoto } from '@/utils/helper';


const ModificaApprofondimentoVini: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const codice = searchParams.get('codice');

  const [formValues, setFormValues] = useState({
    anno: new Date().getFullYear(),
    nome: '',
    cantina: ''
  });

  // Query per recuperare i dati del vino
  const { data: approfondimento, isLoading, error, refetch: refetchApprofondimento } = useQuery({
    queryKey: ['approfondimento-vini', codice],
    queryFn: () => ServerCall.get<ApprofondimentoVino>(`/get_approfondimento_vino?codice=${codice}`),
    enabled: !!codice, // Esegui query solo se c'è un codice
  });
  const { data: dataReferenza, isLoading: isLoadingReferenza, error: errorReferenza, refetch: refetchReferenza } = useQuery({
    queryKey: ['referenza-vini', codice],
    queryFn: () => ServerCall.get<ReferenzeIstanta>(`/getReferenzaByCodice?codice=${codice}`),
    enabled: !!codice, // Esegui query solo se c'è un codice
  });

  // Mutation per creare un nuovo vino
  const createMutation = useMutation({
    mutationFn: (payload: { anno: number; nome: string; cantina: string; codice: string }) => {
      return ServerCall.put('/create_approfondimento_vino', payload)
    },
    onSuccess: (data) => {
      // Aggiorna la cache della query con i nuovi dati ricevuti
      queryClient.setQueryData(['approfondimento-vini', codice], data);

      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" aria-hidden="true" className="h-4 w-4 text-success" />
          <span>Approfondimento vino generato con successo</span>
        </div>
      </>, {
        variant: "success",
        duration: 3000,
        position: "top-right"
      });

      // Invalida la lista generale per aggiornare eventuali altre pagine
      queryClient.invalidateQueries({ queryKey: ['approfondimenti-vini'] });

      // Non fare il redirect immediato, lascia che l'utente veda il risultato
      // L'UI si aggiornerà automaticamente mostrando i dati generati
    },
    onError: () => {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleAlert" className="w-4 h-4 text-danger" />
          <span>Errore durante la generazione dell'approfondimento</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
    }
  });



  useEffect(() => {
    if (dataReferenza) {
      setFormValues({
        ...formValues,
        nome: [dataReferenza.dataFields?.descrizione_uno, dataReferenza.dataFields?.descrizione_tre].filter(Boolean).join(" "),
        cantina: dataReferenza.dataFields?.descrizione_due as string
      })
    }
  }, [dataReferenza]);

  // Aggiorna i valori del form quando arrivano i dati
  useEffect(() => {
    if (approfondimento) {
      setFormValues({
        anno: approfondimento.anno ?? new Date().getFullYear(),
        nome: approfondimento.nome || '',
        cantina: approfondimento.cantina || ''
      });
    }
  }, [approfondimento]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues(prev => ({
      ...prev,
      [name]: name === 'anno' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formValues.nome || !formValues.cantina || !formValues.anno) {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleAlert" className="w-4 h-4 text-danger" />
          <span>Tutti i campi sono obbligatori</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
      return;
    }

    if (formValues.anno < 1800 || formValues.anno > new Date().getFullYear() + 10) {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleAlert" className="w-4 h-4 text-danger" />
          <span>L'anno deve essere valido</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
      return;
    }

    // Un vino gia' generato non si modifica (non esiste la rotta di aggiornamento): resta creazione ed eliminazione
    createMutation.mutate({
      anno: formValues.anno,
      nome: formValues.nome.trim(),
      cantina: formValues.cantina.trim(),
      codice: codice || ''
    });
  };

  const handleCancel = () => {
    navigate('/gestione-approfondimento-vini');
  };

  const isSaving = createMutation.isPending;
  const indietro = { to: '/gestione-approfondimento-vini', etichetta: 'Torna alla lista' };
  const classeSolaLettura = 'rounded-control border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700';

  if (isLoading) {
    return (
      <Pagina titolo="Approfondimento vino" indietro={indietro}>
        <Sezione aria-busy="true">
          <span className="sr-only">Caricamento dell'approfondimento…</span>
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {[0, 1, 2].map((indice) => (
                <div key={indice}>
                  <Skeleton className="mb-2 h-5 w-24" />
                  <Skeleton className="h-10 rounded-control" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[0, 1].map((colonna) => (
                <div key={colonna} className="flex flex-col gap-4">
                  {[0, 1, 2].map((indice) => (
                    <div key={indice}>
                      <Skeleton className="mb-2 h-5 w-32" />
                      <Skeleton className="h-16 rounded-control" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Sezione>
      </Pagina>
    );
  }

  if (error) {
    return (
      <Pagina titolo="Approfondimento vino" indietro={indietro}>
        <Sezione>
          <PageError
            compatta
            titolo="Approfondimento non caricato"
            motivo={(error as Error)?.message || "Errore nel caricamento dei dati"}
            onRiprova={() => refetchApprofondimento()}
          />
        </Sezione>
      </Pagina>
    );
  }

  return (
    <Pagina
      titolo={formValues.nome || 'Nuovo Vino'}
      descrizione={codice ? `Codice: ${codice}` : undefined}
      indietro={indietro}
      badges={
        approfondimento?.id ? (
          <StatusBadge tono="success" etichetta="Generato" icon="CircleCheck" />
        ) : (
          <StatusBadge tono="warning" etichetta="Da generare" icon="Sparkles" />
        )
      }
    >
      {/* Sezione Foto e Info Prodotto */}
      <Sezione titolo="Foto Prodotto" icona="Wine">
        {errorReferenza ? (
          <PageError
            compatta
            titolo="Foto del prodotto non caricata"
            motivo={(errorReferenza as Error)?.message || "Errore nel caricamento della referenza"}
            onRiprova={() => refetchReferenza()}
          />
        ) : (
          <div className="flex items-center gap-4">
            {isLoadingReferenza ? (
              <Skeleton className="h-32 w-32 rounded-card" />
            ) : dataReferenza?.foto?.[0] ? (
              <img
                src={urlFoto(dataReferenza.foto)[0]}
                alt={formValues.nome || 'Vino'}
                className="h-32 w-32 rounded-card border border-slate-200 object-contain"
              />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-card border border-slate-200 bg-slate-100">
                <Lucide icon="Wine" aria-hidden="true" className="h-8 w-8 text-slate-400" />
              </div>
            )}
            {codice && (
              <p className="text-sm text-slate-500">Codice: {codice}</p>
            )}
          </div>
        )}
      </Sezione>

      {approfondimento?.id ? (
        // Vino gia' generato: i dati restano in sola lettura (la modifica non e' disponibile)
        <div className="flex flex-col gap-6">
          <Sezione titolo="Dati del vino" descrizione="Sola lettura" icona="Lock">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <FormLabel>Anno</FormLabel>
                <div className={classeSolaLettura}>{approfondimento.anno ?? 'Non specificato'}</div>
              </div>
              <div>
                <FormLabel>Nome Vino</FormLabel>
                <div className={classeSolaLettura}>{approfondimento.nome || 'Non specificato'}</div>
              </div>
              <div>
                <FormLabel>Cantina</FormLabel>
                <div className={classeSolaLettura}>{approfondimento.cantina || 'Non specificata'}</div>
              </div>
            </div>
          </Sezione>

          {/* Dati generati dall'AI */}
          <Sezione titolo="Informazioni Generate dall'AI" descrizione="Sola lettura" icona="Lock">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Colonna Sinistra */}
              <div className="flex flex-col gap-4">
                <div>
                  <FormLabel>Provenienza</FormLabel>
                  <div className={classeSolaLettura}>
                    {approfondimento.provenienza || 'Non specificata'}
                  </div>
                </div>

                <div>
                  <FormLabel>Colore</FormLabel>
                  <div className={classeSolaLettura}>
                    {approfondimento.colore || 'Non specificato'}
                  </div>
                </div>

                <div>
                  <FormLabel>Tasso Alcolico</FormLabel>
                  <div className={classeSolaLettura}>
                    {approfondimento.tasso_alcolico || 'Non specificato'}
                  </div>
                </div>

                <div>
                  <FormLabel>Temperatura di Servizio</FormLabel>
                  <div className={classeSolaLettura}>
                    {approfondimento.temperatura_di_servizio || 'Non specificata'}
                  </div>
                </div>
              </div>

              {/* Colonna Destra */}
              <div className="flex flex-col gap-4">
                <div>
                  <FormLabel>Profumo</FormLabel>
                  <div className={`${classeSolaLettura} min-h-20`}>
                    {approfondimento.profumo || 'Non specificato'}
                  </div>
                </div>

                <div>
                  <FormLabel>Gusto</FormLabel>
                  <div className={`${classeSolaLettura} min-h-20`}>
                    {approfondimento.gusto || 'Non specificato'}
                  </div>
                </div>

                <div>
                  <FormLabel>Abbinamenti</FormLabel>
                  <div className={`${classeSolaLettura} min-h-16`}>
                    {approfondimento.abbinamenti || 'Non specificati'}
                  </div>
                </div>
              </div>
            </div>

            {/* Dettagli Cantina - Full Width */}
            {approfondimento.dettagli_cantina && (
              <div className="mt-4">
                <FormLabel>Dettagli Cantina</FormLabel>
                <div className={`${classeSolaLettura} min-h-20`}>
                  {approfondimento.dettagli_cantina}
                </div>
              </div>
            )}
          </Sezione>

          {/* Il ritorno all'elenco è già nell'intestazione */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline-secondary" onClick={handleCancel}>
              Indietro
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Dati Editabili */}
          <Sezione titolo="Dati Modificabili" icona="PenTool">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <FormField etichetta="Anno" obbligatorio aiuto="Anno di produzione del vino">
                <FormInput
                  name="anno"
                  type="number"
                  value={formValues.anno.toString()}
                  onChange={handleChange}
                  min="1800"
                  max={new Date().getFullYear() + 10}
                  className={!formValues.anno ? 'border-warning' : ''}
                />
              </FormField>

              <FormField etichetta="Nome Vino" obbligatorio aiuto="Nome completo della denominazione">
                <FormInput
                  name="nome"
                  type="text"
                  value={formValues.nome}
                  onChange={handleChange}
                  placeholder="Es. Barolo, Chianti Classico..."
                  className={!formValues.nome ? 'border-warning' : ''}
                />
              </FormField>

              <FormField etichetta="Cantina" obbligatorio aiuto="Nome del produttore">
                <FormInput
                  name="cantina"
                  type="text"
                  value={formValues.cantina}
                  onChange={handleChange}
                  placeholder="Es. Antinori, Gaja..."
                  className={!formValues.cantina ? 'border-warning' : ''}
                />
              </FormField>
            </div>
          </Sezione>

          {/* Azioni: il ritorno all'elenco è già nell'intestazione */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline-secondary"
              onClick={handleCancel}
            >
              Annulla
            </Button>

            <Button
              type="submit"
              variant="primary"
              loading={isSaving}
            >
              {!isSaving && <Lucide icon="Sparkles" aria-hidden="true" className="mr-2 h-4 w-4" />}
              Genera
            </Button>
          </div>
        </form>
      )}
    </Pagina>
  );
};

export default ModificaApprofondimentoVini;
