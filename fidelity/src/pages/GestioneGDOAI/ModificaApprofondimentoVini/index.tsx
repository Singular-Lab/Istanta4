import Button from '@/components/Base/Button';
import { FormInput, FormLabel } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
import Skeleton from '@/components/Base/Skeleton';
import { useNotification } from '@/context/NotificationContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ServerCall } from '../../../../lib/server_call';
import { ApprofondimentoVino, ReferenzeIstanta } from '../../../../lib/types';


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
  const { data: approfondimento, isLoading, error } = useQuery({
    queryKey: ['approfondimento-vini', codice],
    queryFn: () => ServerCall.get<ApprofondimentoVino>(`/get_approfondimento_vino?codice=${codice}`),
    enabled: !!codice, // Esegui query solo se c'è un codice
  });
  const { data: dataReferenza, isLoading: isLoadingReferenza, error: errorReferenza } = useQuery({
    queryKey: ['referenza-vini', codice],
    queryFn: () => ServerCall.get<ReferenzeIstanta>(`/getReferenzaByCodice?codice=${codice}`),
    enabled: !!codice, // Esegui query solo se c'è un codice
  });

  // Mutation per creare un nuovo vino
  const createMutation = useMutation({
    mutationFn: (payload: { anno: number; nome: string; cantina: string; codice: string }) => {
      console.log(payload);
      return ServerCall.put('/create_approfondimento_vino', payload)
    },
    onSuccess: (data) => {
      // Aggiorna la cache della query con i nuovi dati ricevuti
      queryClient.setQueryData(['approfondimento-vini', codice], data);

      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-green-500" />
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
          <Lucide icon="CircleAlert" className="w-4 h-4 text-red-500" />
          <span>Errore durante la generazione dell'approfondimento</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
    }
  });

  // Mutation per aggiornare un vino esistente
  const updateMutation = useMutation({
    mutationFn: (payload: { anno: number; nome: string; cantina: string }) =>
      ServerCall.put(`/update_vino/${codice}`, payload),
    onSuccess: () => {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleCheck" className="w-4 h-4 text-green-500" />
          <span>Vino aggiornato con successo</span>
        </div>
      </>, {
        variant: "success",
        duration: 3000,
        position: "top-right"
      });
      queryClient.invalidateQueries({ queryKey: ['approfondimenti-vini'] });
      queryClient.invalidateQueries({ queryKey: ['approfondimento-vini', codice] });
      navigate('/gestione-approfondimento-vini');
    },
    onError: () => {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleAlert" className="w-4 h-4 text-red-500" />
          <span>Errore durante l'aggiornamento</span>
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

  // Gestisce gli errori di fetch
  useEffect(() => {
    if (error) {
      showNotification(<>
        <div className="flex items-center gap-2">
          <Lucide icon="CircleAlert" className="w-4 h-4 text-red-500" />
          <span>Errore nel caricamento dei dati</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
    }
  }, [error, showNotification]);

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
          <Lucide icon="CircleAlert" className="w-4 h-4 text-red-500" />
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
          <Lucide icon="CircleAlert" className="w-4 h-4 text-red-500" />
          <span>L'anno deve essere valido</span>
        </div>
      </>, {
        variant: "error",
        duration: 3000,
        position: "top-right"
      });
      return;
    }

    const payload = {
      anno: formValues.anno,
      nome: formValues.nome.trim(),
      cantina: formValues.cantina.trim(),
      ...(codice && { codice })
    };

    console.log(approfondimento);
    if (approfondimento != null && approfondimento.id) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({ ...payload, codice: codice || '' });
    }
  };

  const handleCancel = () => {
    navigate('/gestione-approfondimento-vini');
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isNewWine = !approfondimento?.id;

  // Componente Skeleton per il loading
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="space-y-3">
        <Skeleton height="32px" width="300px" />
        <Skeleton height="20px" width="150px" />
      </div>

      {/* Form Section Skeleton */}
      <div className="box p-6">
        <div className="space-y-6">
          {/* Dati Modificabili Section */}
          <div>
            <div className="flex items-center mb-4">
              <Skeleton height="20px" width="20px" borderRadius="4px" className="mr-2" />
              <Skeleton height="24px" width="180px" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Anno */}
              <div>
                <Skeleton height="20px" width="60px" className="mb-2" />
                <Skeleton height="42px" width="100%" borderRadius="6px" />
              </div>
              {/* Nome Vino */}
              <div>
                <Skeleton height="20px" width="90px" className="mb-2" />
                <Skeleton height="42px" width="100%" borderRadius="6px" />
              </div>
              {/* Cantina */}
              <div>
                <Skeleton height="20px" width="70px" className="mb-2" />
                <Skeleton height="42px" width="100%" borderRadius="6px" />
              </div>
            </div>
          </div>

          {/* Informazioni Dettagliate Section */}
          <div>
            <div className="flex items-center mb-4">
              <Skeleton height="20px" width="20px" borderRadius="4px" className="mr-2" />
              <Skeleton height="24px" width="220px" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Colonna Sinistra */}
              <div className="space-y-4">
                {['Provenienza', 'Colore', 'Tasso Alcolico', 'Temperatura di Servizio'].map((_, index) => (
                  <div key={index}>
                    <Skeleton height="20px" width="120px" className="mb-2" />
                    <Skeleton height="42px" width="100%" borderRadius="6px" />
                  </div>
                ))}
              </div>
              {/* Colonna Destra */}
              <div className="space-y-4">
                <div>
                  <Skeleton height="20px" width="80px" className="mb-2" />
                  <Skeleton height="80px" width="100%" borderRadius="6px" />
                </div>
                <div>
                  <Skeleton height="20px" width="60px" className="mb-2" />
                  <Skeleton height="80px" width="100%" borderRadius="6px" />
                </div>
                <div>
                  <Skeleton height="20px" width="100px" className="mb-2" />
                  <Skeleton height="60px" width="100%" borderRadius="6px" />
                </div>
              </div>
            </div>
            {/* Dettagli Cantina - Full Width */}
            <div className="mt-4">
              <Skeleton height="20px" width="140px" className="mb-2" />
              <Skeleton height="80px" width="100%" borderRadius="6px" />
            </div>
          </div>

          {/* Actions Skeleton */}
          <div className="flex justify-end space-x-3 pt-5 border-t">
            <Skeleton height="40px" width="100px" borderRadius="6px" />
            <Skeleton height="40px" width="120px" borderRadius="6px" />
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex-1 space-y-5">
      {/* Titolo principale */}
      <PageHeader title={formValues.nome || 'Nuovo Vino'} />

      {/* Sezione Foto e Info Prodotto */}
      <div className="box box--stacked mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center">
              <Lucide icon="Wine" className="w-5 h-5 mr-2 text-primary" />
              Foto Prodotto
            </h2>
            {approfondimento?.id ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <Lucide icon="CircleCheck" className="w-4 h-4 mr-1.5" />
                Generato
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                <Lucide icon="Sparkles" className="w-4 h-4 mr-1.5" />
                Da generare
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {dataReferenza?.foto?.[0] ? (
              <img
                src={dataReferenza.foto[0]}
                alt={formValues.nome || 'Vino'}
                className="object-contain w-32 h-32 rounded-lg border border-slate-200 shadow-sm"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                <Lucide icon="Wine" className="w-8 h-8 text-slate-400" />
              </div>
            )}
            {codice && (
              <p className="text-sm text-slate-500">Codice: {codice}</p>
            )}
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="box p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dati Editabili */}
          <div>
            <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center">
              <Lucide icon="PenTool" className="w-5 h-5 mr-2 text-primary" />
              Dati Modificabili
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <FormLabel>Anno *</FormLabel>
                <FormInput
                  name="anno"
                  type="number"
                  value={formValues.anno.toString()}
                  onChange={handleChange}
                  min="1800"
                  max={new Date().getFullYear() + 10}
                  className={!formValues.anno ? 'border-amber-300' : ''}
                />
                <p className="text-xs text-slate-500 mt-1">Anno di produzione del vino</p>
              </div>

              <div>
                <FormLabel>Nome Vino *</FormLabel>
                <FormInput
                  name="nome"
                  type="text"
                  value={formValues.nome}
                  onChange={handleChange}
                  placeholder="Es. Barolo, Chianti Classico..."
                  className={!formValues.nome ? 'border-amber-300' : ''}
                />
                <p className="text-xs text-slate-500 mt-1">Nome completo della denominazione</p>
              </div>

              <div>
                <FormLabel>Cantina *</FormLabel>
                <FormInput
                  name="cantina"
                  type="text"
                  value={formValues.cantina}
                  onChange={handleChange}
                  placeholder="Es. Antinori, Gaja..."
                  className={!formValues.cantina ? 'border-amber-300' : ''}
                />
                <p className="text-xs text-slate-500 mt-1">Nome del produttore</p>
              </div>
            </div>
          </div>

          {/* Dati Read-Only (solo se esistono) */}
          {approfondimento && (
            <div className="pt-6 border-t border-slate-200">
              <h3 className="text-lg font-medium text-slate-800 mb-4 flex items-center">
                <Lucide icon="Lock" className="w-5 h-5 mr-2 text-slate-400" />
                Informazioni Generate dall'AI
                <span className="ml-2 text-xs font-normal text-slate-500">(sola lettura)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Colonna Sinistra */}
                <div className="space-y-4">
                  <div>
                    <FormLabel>Provenienza</FormLabel>
                    <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700">
                      {approfondimento.provenienza || 'Non specificata'}
                    </div>
                  </div>

                  <div>
                    <FormLabel>Colore</FormLabel>
                    <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700">
                      {approfondimento.colore || 'Non specificato'}
                    </div>
                  </div>

                  <div>
                    <FormLabel>Tasso Alcolico</FormLabel>
                    <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700">
                      {approfondimento.tasso_alcolico || 'Non specificato'}
                    </div>
                  </div>

                  <div>
                    <FormLabel>Temperatura di Servizio</FormLabel>
                    <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700">
                      {approfondimento.temperatura_di_servizio || 'Non specificata'}
                    </div>
                  </div>
                </div>

                {/* Colonna Destra */}
                <div className="space-y-4">
                  <div>
                    <FormLabel>Profumo</FormLabel>
                    <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 min-h-[80px]">
                      {approfondimento.profumo || 'Non specificato'}
                    </div>
                  </div>

                  <div>
                    <FormLabel>Gusto</FormLabel>
                    <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 min-h-[80px]">
                      {approfondimento.gusto || 'Non specificato'}
                    </div>
                  </div>

                  <div>
                    <FormLabel>Abbinamenti</FormLabel>
                    <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 min-h-[60px]">
                      {approfondimento.abbinamenti || 'Non specificati'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dettagli Cantina - Full Width */}
              {approfondimento.dettagli_cantina && (
                <div className="mt-4">
                  <FormLabel>Dettagli Cantina</FormLabel>
                  <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 min-h-[80px]">
                    {approfondimento.dettagli_cantina}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-5 border-t">
            <Button
              type="button"
              variant="outline-secondary"
              onClick={handleCancel}
            >
              <Lucide icon="X" className="w-4 h-4 mr-2" />
              {approfondimento?.id ? 'Indietro' : 'Annulla'}
            </Button>

            {/* Mostra il pulsante per tornare alla lista solo se esiste un approfondimento */}
            {approfondimento?.id && (
              <Button
                type="button"
                variant="outline-primary"
                onClick={() => navigate('/gestione-approfondimento-vini')}
              >
                <Lucide icon="List" className="w-4 h-4 mr-2" />
                Torna alla Lista
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              loading={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  {isNewWine ? 'Generando...' : 'Salvando...'}
                </>
              ) : (
                <>
                  <Lucide icon="Sparkles" className="w-4 h-4 mr-2" />
                  {isNewWine ? 'Genera' : 'Rigenera'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModificaApprofondimentoVini;
