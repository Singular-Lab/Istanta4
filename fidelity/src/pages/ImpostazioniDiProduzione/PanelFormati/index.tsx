import Badge from '@/components/Base/Badge';
import Button from '@/components/Base/Button';
import { FormField, FormInput, FormSelect, FormTextarea } from '@/components/Base/Form';
import { Dialog } from "@/components/Base/Headless";
import Lucide from '@/components/Base/Lucide';
import Table from '@/components/Base/Table';
import ConfirmDialog from '@/components/ConfirmDialog';
import { valoreOAssente } from '@/utils/format';
import PannelloElenco from '../PannelloElenco';
import { useNotification } from '@/context/NotificationContext';
import { useFetchFormati } from '@/query/query';
import { yupResolver } from '@hookform/resolvers/yup';
import { useMutation } from '@tanstack/react-query';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import * as yup from 'yup';
import { TIPO_LAVORAZIONE } from '../../../../lib/enums';
import { ServerCall } from '../../../../lib/server_call';
import { FormatiResponseDTO } from '../../../../server/core/dto';

// Tipo per il form di modifica
type FormatiFormData = {
  id?: string;
  nome: string;
  codice: string;
  descrizione: string;
  tipo_lavorazione: number;
  createdat?: Date;
  updatedat?: Date;
};

export interface PanelFormatiRefHandle {
  refetchFormati: () => void;
}

// Schema di validazione per il form
const schemaFormati = yup.object().shape({
  nome: yup.string().required("Il nome è obbligatorio").max(100, "Massimo 100 caratteri"),
  codice: yup.string().required("Il codice è obbligatorio").max(50, "Massimo 50 caratteri"),
  descrizione: yup.string().required("La descrizione è obbligatoria").max(255, "Massimo 255 caratteri"),
  tipo_lavorazione: yup.number().transform(value => (isNaN(value) || value === null || value === undefined) ? undefined : Number(value)).required('Il tipo di lavorazione è obbligatorio').oneOf(Object.values(TIPO_LAVORAZIONE).filter(v => typeof v === 'number') as number[], 'Seleziona un tipo di lavorazione valido'),
  id: yup.string().optional(),
  createdat: yup.date().optional(),
  updatedat: yup.date().optional()
});

// Opzioni dei tipi di lavorazione (chiavi numeriche dell'enum), per filtro e modifica
const OPZIONI_TIPO_LAVORAZIONE = Object.keys(TIPO_LAVORAZIONE)
  .filter(key => !isNaN(Number(key)))
  .map((key) => {
    const enumKey = parseInt(key, 10) as unknown as keyof typeof TIPO_LAVORAZIONE;
    return <option key={enumKey} value={enumKey}>{TIPO_LAVORAZIONE[enumKey]}</option>;
  });

const PanelFormati = forwardRef<PanelFormatiRefHandle>((props, ref) => {
  // Hooks e state
  const { showNotification } = useNotification();
  const [isModaleEliminazioneAperto, setIsModaleEliminazioneAperto] = useState(false);
  const [isModaleModificaAperto, setIsModaleModificaAperto] = useState(false);
  const [selectedFormato, setSelectedFormato] = useState<FormatiResponseDTO | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('');

  const {
    register: registerModifica,
    handleSubmit: handleSubmitModifica,
    formState: { errors: errorsModifica },
    reset: resetModificaForm,
  } = useForm<FormatiFormData>({
    resolver: yupResolver(schemaFormati),
  });

  // Query per i dati
  const {
    data: formati,
    isLoading,
    isError,
    error,
    refetch
  } = useFetchFormati();

  // Filtri per la ricerca
  const filteredFormati = formati?.filter(formato => {
    const matchesSearch = formato.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formato.codice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formato.descrizione?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterTipo === '' || formato.tipo_lavorazione?.toString() === filterTipo;

    return matchesSearch && matchesFilter;
  });

  // Mutation per eliminazione formato
  const mutationEliminazioneFormato = useMutation({
    mutationFn: async (guidId: string) => {
      return await ServerCall.delete(`/deleteFormato/${guidId}`);
    },
    onSuccess: () => {
      showNotification("Formato eliminato con successo", { variant: "success" });
      refetch();
      handleChiudiModaleEliminazione();
    },
    onError: (error) => {
      showNotification(
        `Errore durante l'eliminazione del formato: ${error instanceof Error ? error.message : "dettagli in console."}`,
        { variant: "error" }
      );
      console.error("Errore eliminazione formato:", error);
      handleChiudiModaleEliminazione();
    }
  });

  const mutationAggiornamentoFormato = useMutation({
    mutationFn: async (data: FormatiFormData) => {
      if (!data.id) throw new Error("ID Formato mancante per l'aggiornamento.");
      return await ServerCall.put(`/salvaFormato`, data);
    },
    onSuccess: () => {
      showNotification("Formato aggiornato con successo", { variant: "success" });
      refetch();
      handleChiudiModaleModifica();
    },
    onError: (error) => {
      showNotification(
        `Errore durante l'aggiornamento del formato: ${error instanceof Error ? error.message : "errore sconosciuto"}`,
        { variant: "error" }
      );
      console.error("Errore aggiornamento formato:", error);
    }
  });

  // Funzioni di utility
  const handleAperturaModaleEliminazione = (formato: FormatiResponseDTO) => {
    setSelectedFormato(formato);
    setIsModaleEliminazioneAperto(true);
  };

  const handleChiudiModaleEliminazione = () => {
    setIsModaleEliminazioneAperto(false);
    setSelectedFormato(null);
  };

  const handleEliminaFormato = () => {
    if (selectedFormato?.id) {
      mutationEliminazioneFormato.mutate(selectedFormato.id);
    }
  };

  const handleAperturaModaleModifica = (formato: FormatiResponseDTO) => {
    setSelectedFormato(formato);
    resetModificaForm({
      id: formato.id,
      nome: formato.nome,
      codice: formato.codice,
      descrizione: formato.descrizione,
      tipo_lavorazione: formato.tipo_lavorazione,
    });
    setIsModaleModificaAperto(true);
  };

  const handleChiudiModaleModifica = () => {
    setIsModaleModificaAperto(false);
    setSelectedFormato(null);
    resetModificaForm();
  };

  const handleModificaFormatoSubmit: SubmitHandler<FormatiFormData> = (data) => {
    if (selectedFormato?.id) {
      // Rimuovo eventuali proprietà undefined per rispettare il tipo richiesto
      const payload = {
        ...data,
        id: selectedFormato.id,
      };
      mutationAggiornamentoFormato.mutate(payload);
    } else {
      console.error("ID del formato selezionato non disponibile per l'aggiornamento.");
      showNotification("ID formato mancante: non è stato possibile aggiornare il formato.", { variant: "warning" });
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterTipo('');
  };

  // Esponi refetch attraverso ref
  useImperativeHandle(ref, () => ({
    refetchFormati: refetch
  }));

  // Render del componente
  return (
    <>
      {/* Conferma di eliminazione */}
      <ConfirmDialog
        open={isModaleEliminazioneAperto && selectedFormato !== null}
        title="Eliminare il formato?"
        description={<>Il formato <strong>{selectedFormato?.nome}</strong> verrà eliminato. Questa operazione non può essere annullata.</>}
        confirmLabel="Elimina"
        loading={mutationEliminazioneFormato.isPending}
        onClose={handleChiudiModaleEliminazione}
        onConfirm={handleEliminaFormato}
      />

      {/* Modale di Modifica Formato */}
      <Dialog
        open={isModaleModificaAperto && selectedFormato !== null}
        onClose={handleChiudiModaleModifica}
        size="lg"
      >
        <Dialog.Panel>
          <form onSubmit={handleSubmitModifica(handleModificaFormatoSubmit)}>
            <Dialog.Title>Modifica formato {selectedFormato?.nome}</Dialog.Title>
            <Dialog.Description className="grid grid-cols-12 gap-4">
              <FormField className="col-span-12 sm:col-span-6" etichetta="Nome" obbligatorio errore={errorsModifica.nome?.message}>
                <FormInput id="modifica-nome-formato" type="text" {...registerModifica("nome")} />
              </FormField>
              <FormField className="col-span-12 sm:col-span-6" etichetta="Codice" obbligatorio errore={errorsModifica.codice?.message}>
                <FormInput id="modifica-codice-formato" type="text" {...registerModifica("codice")} />
              </FormField>
              <FormField className="col-span-12" etichetta="Descrizione" obbligatorio errore={errorsModifica.descrizione?.message}>
                <FormTextarea id="modifica-descrizione-formato" rows={3} {...registerModifica("descrizione")} />
              </FormField>
              <FormField className="col-span-12" etichetta="Tipo lavorazione" obbligatorio errore={errorsModifica.tipo_lavorazione?.message}>
                <FormSelect id="modifica-tipo-lavorazione" {...registerModifica("tipo_lavorazione")}>
                  <option value="">Seleziona un tipo</option>
                  {OPZIONI_TIPO_LAVORAZIONE}
                </FormSelect>
              </FormField>
            </Dialog.Description>
            <Dialog.Footer>
              <Button
                type="button"
                variant="outline-secondary"
                onClick={handleChiudiModaleModifica}
                disabled={mutationAggiornamentoFormato.isPending}
              >
                Annulla
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={mutationAggiornamentoFormato.isPending}
              >
                Salva modifiche
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Panel>
      </Dialog>

      <PannelloElenco
        ricerca={searchTerm}
        onRicerca={setSearchTerm}
        etichettaRicerca="Cerca formati"
        placeholderRicerca="Cerca formati…"
        filtri={
          <FormSelect
            formSelectSize="sm"
            aria-label="Tipo lavorazione"
            className="sm:w-48"
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
          >
            <option value="">Tutti i tipi</option>
            {OPZIONI_TIPO_LAVORAZIONE}
          </FormSelect>
        }
        caricamento={isLoading}
        etichettaCaricamento="Caricamento formati…"
        errore={isError ? {
          titolo: "Formati non caricati",
          motivo: (error as Error)?.message || "Non è stato possibile caricare i formati.",
          onRiprova: () => refetch(),
        } : null}
        totale={formati?.length ?? 0}
        filtrati={filteredFormati?.length ?? 0}
        vuoto={{
          icona: "FileImage",
          titolo: "Nessun formato disponibile",
          descrizione: "Non ci sono formati configurati. Aggiungine uno con Nuovo formato.",
        }}
        onAzzeraFiltri={handleClearFilters}
        intestazione={
          <>
            <Table.Th>Formato</Table.Th>
            <Table.Th>Codice formato</Table.Th>
            <Table.Th>Descrizione</Table.Th>
            <Table.Th>Tipo lavorazione</Table.Th>
            <Table.Th className="text-right"><span className="sr-only">Azioni</span></Table.Th>
          </>
        }
      >
        {filteredFormati?.map((formato, index) => (
          <Table.Tr key={formato.id || index}>
            <Table.Td className="font-medium text-slate-800">{formato.nome}</Table.Td>
            <Table.Td>
              <span className="rounded-control bg-slate-100 px-2 py-1 font-mono text-sm text-slate-600">
                {formato.codice}
              </span>
            </Table.Td>
            <Table.Td>
              <div className="line-clamp-2 max-w-xs text-sm text-slate-600">
                {valoreOAssente(formato.descrizione)}
              </div>
            </Table.Td>
            <Table.Td>
              <Badge variant="secondary" size="sm">
                {TIPO_LAVORAZIONE[formato.tipo_lavorazione] || "Non specificato"}
              </Badge>
            </Table.Td>
            <Table.Td className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => handleAperturaModaleModifica(formato)}
                  aria-label={`Modifica formato ${formato.nome}`}
                  title="Modifica"
                >
                  <Lucide icon="PenLine" aria-hidden="true" className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleAperturaModaleEliminazione(formato)}
                  aria-label={`Elimina formato ${formato.nome}`}
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

PanelFormati.displayName = "PanelFormati";
export default PanelFormati;
