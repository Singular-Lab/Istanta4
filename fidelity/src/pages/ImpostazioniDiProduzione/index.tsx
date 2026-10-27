import { FormField, FormInput, FormSelect, FormTextarea } from "@/components/Base/Form";
import { Dialog } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";

import Button from "@/components/Base/Button";
import GestioneSchemi from "@/pages/LavorazioniInCorso/DettagliLavorazioneInCorso/GestioneSchemi";
import PanelCombinazioni from "@/pages/ImpostazioniDiProduzione/PanelCombinazioni";
import PanelFormati from "@/pages/ImpostazioniDiProduzione/PanelFormati";
import PanelFunzionalita from "@/pages/ImpostazioniDiProduzione/PanelFunzionalita";
import PanelMenabo from "@/pages/ImpostazioniDiProduzione/PanelMenabo";
import PanelNamingConvention from "@/pages/ImpostazioniDiProduzione/PanelNamingConvention";
import PanelTipiExport from "@/pages/ImpostazioniDiProduzione/PanelTipiExport";
import React, { useCallback, useRef, useState } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router-dom";

// Tipi di export per modifica
type TipiExportEditState = TipiDiExportAttributes & { id?: string };

import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import NamingConvention from "@/components/NamingConvention";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import { useNotification } from "@/context/NotificationContext";
import { useFetchAddestramenti, useFetchDatiNamingConventionFromIstanta, useFetchNamingConventions } from "@/query/query";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import { Resolver, SubmitHandler, useForm } from "react-hook-form";
import * as yup from "yup";
import { MODALITA_TIPO_EXPORT, TIPO_LAVORAZIONE } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { TipiDiExportAttributes } from "../../../lib/types";
import { FormatiResponseDTO } from "../../../server/core/dto";

// Tipi per le risposte aggiornate del server
interface ServerResponse<T> {
  esito: boolean;
  error: string;
  message?: string;
  isUpdate?: boolean;
  data?: T;
}


const schematipidiexport = yup.object().shape({
  nome_tipiexport: yup.string().required("Il nome è obbligatorio"),
  codice_tipiexport: yup.string().required("Il codice è obbligatorio"),
  modalita_tipiexport: yup.mixed<MODALITA_TIPO_EXPORT>().optional(),
  guid_namingconvention_tipiexport: yup.string().optional(),
  filtri_tipiexport: yup.array().optional(),
});
const schemaFormati: yup.ObjectSchema<FormatiResponseDTO> = yup.object().shape({
  id: yup.string().optional(),
  nome: yup.string().required("Il nome è obbligatorio"),
  codice: yup.string().required("Il codice è obbligatorio"),
  descrizione: yup.string().required("La descrizione è obbligatoria"),
  tipo_lavorazione: yup.number().transform(value => (isNaN(value) || value === null || value === undefined) ? undefined : Number(value)).required('Il tipo di lavorazione è obbligatorio').oneOf([1, 2], 'Seleziona un tipo di lavorazione valido'),
  updatedat: yup.date().optional(),
  createdat: yup.date().optional(),
});

const schemaCombinazioni = yup.object().shape({
  titolo: yup.string(),
  guidCanale: yup.array().of(yup.string().required("Il canale è obbligatorio")), // Cambiato in array
  guidArea: yup.array().of(yup.string().required("L'area è obbligatoria")), // Cambiato in array
  guidPv: yup.array().of(yup.string().nullable().notRequired()), // Cambiato in array e aggiornato per gestire null o undefined
  guidFormato: yup.string().required("Il formato è obbligatorio"),
  guidTipoExport: yup.array().of(yup.string().required("Il tipo di export è obbligatorio")), // Cambiato in array
  quantitaCopie: yup.number().required("La quantità di copie è obbligatoria"),
});
function Main() {

  const navigate = useNavigate();

  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const { showNotification } = useNotification();

  const [showDialogCreazioneFormati, setShowDialogCreazioneFormati] = useState(false);
  const [showDialogCreazioneTipiExport, setShowDialogCreazioneTipiExport] = useState(false);
  const [showDialogCreazioneCombinazioni, setShowDialogCreazioneCombinazioni] = useState(false);
  const [showDialogCreazioneNamingConvention, setShowDialogCreazioneNamingConvention] = useState(false);
  const [showDialogTemplateEsisteGia, setShowDialogTemplateEsisteGia] = useState(false);
  const refPanelCombinazioni = useRef<any>(null);
  const [namingConvention, setNamingConvention] = useState<{ id: string, nome: string, descrizione: string, nomeVisual: string }[]>([]);
  const [showDialogEliminazione, setShowDialogEliminazione] = useState(false);
  const refPannelloFormati = useRef<any>(null);
  const refPannelloTipiExport = useRef<any>(null);
  const refPannelloNamingConvention = useRef<any>(null);
  const refNamingConvention = useRef<any>(null);
  const revalidator = useRevalidator();
  // Stati per la modalità modifica naming convention
  const [isModificaNamingConvention, setIsModificaNamingConvention] = useState(false);
  const [namingConventionDaModificare, setNamingConventionDaModificare] = useState<any | null>(null);
  const [namingConventionData, setNamingConventionData] = useState<any[]>([]);

  // Stato per dialog modifica tipi di export
  const [showDialogModificaTipiExport, setShowDialogModificaTipiExport] = useState(false);
  const [tipiExportEdit, setTipiExportEdit] = useState<TipiExportEditState | null>(null);
  // Form per modifica tipi di export
  const { register: registerEdit, handleSubmit: handleSubmitEdit, formState: { errors: errorsEdit, isSubmitting: isSubmittingEdit }, reset: resetEdit, control: controlEdit } = useForm<TipiDiExportAttributes>({
    resolver: yupResolver(schematipidiexport),
  });

  // Handler apertura dialog modifica
  const openDialogModificaTipiExport = (data: TipiExportEditState) => {
    setTipiExportEdit(data);
    setShowDialogModificaTipiExport(true);
    resetEdit({
      nome_tipiexport: data.nome_tipiexport || '',
      codice_tipiexport: data.codice_tipiexport || '',
      modalita_tipiexport: data.modalita_tipiexport || undefined,
      guid_namingconvention_tipiexport: data.guid_namingconvention_tipiexport || '',
      filtri_tipiexport: data.filtri_tipiexport || [],
    });
  };

  // Handler submit modifica
  const handleModificaTipiExport: SubmitHandler<TipiDiExportAttributes> = (formData) => {
    if (!tipiExportEdit) return;
    const modalitaValue = (formData.modalita_tipiexport as any);
    const processedData: TipiDiExportAttributes & { id?: string; is_modifica: boolean; } = {
      ...formData,
      modalita_tipiexport: (modalitaValue && modalitaValue !== "")
        ? modalitaValue as MODALITA_TIPO_EXPORT
        : undefined,
      guid_namingconvention_tipiexport: (formData.guid_namingconvention_tipiexport && formData.guid_namingconvention_tipiexport !== "")
        ? formData.guid_namingconvention_tipiexport
        : undefined,
      id_tipiexport: tipiExportEdit.id, // Aggiungi l'ID per la modifica
      is_modifica: true
    };
    // Chiamata API update con ID (restituita: isSubmitting resta attivo fino alla risposta)
    return ServerCall.put<TipiDiExportAttributes & { id?: string }>(`/creaTipoExport`, processedData)
      .then(() => {
        setShowDialogModificaTipiExport(false);
        setTipiExportEdit(null);
        if (refPannelloTipiExport.current) refPannelloTipiExport.current?.refetchTipiExport();
        showNotification("Tipo di export modificato con successo", { variant: "success" });
        revalidator.revalidate();
      })
      .catch((error) => {
        showNotification(`Errore durante la modifica: ${error.message}`, { variant: "error" });
        revalidator.revalidate();
      });
  };

  const handleCloseDialogModificaTipiExport = () => {
    setShowDialogModificaTipiExport(false);
    setTipiExportEdit(null);
    resetEdit();
  };

  const [nomeNamingConvention, setNomeNamingConvention] = useState("");
  const [descrizioneNamingConvention, setDescrizioneNamingConvention] = useState("");

  const { register, handleSubmit, formState: { errors }, reset, control } = useForm<TipiDiExportAttributes>({
    resolver: yupResolver(schematipidiexport),
  });

  const { register: registerFormati, handleSubmit: handleSubmitFormati, formState: { errors: errorsFormati }, reset: resetFormati, watch: watchFormati } = useForm<FormatiResponseDTO>({
    resolver: yupResolver(schemaFormati),
  });




  const { register: registerCombinazioni, setValue: setValueCombinazioni, handleSubmit: handleSubmitCombinazioni, formState: { errors: errorsCombinazioni }, reset: resetCombinazioni } = useForm<{
    titolo: string;
    guidCanale: string[];
    guidArea: string[];
    guidPv?: (string | undefined)[];
    guidFormato: string;
    guidTipoExport: string[];
    quantitaCopie: number;
  }>({
    resolver: yupResolver(schemaCombinazioni, {
      abortEarly: true
    }) as Resolver<{
      titolo: string;
      guidCanale: string[];
      guidArea: string[];
      guidPv?: (string | undefined)[];
      guidFormato: string;
      guidTipoExport: string[];
      quantitaCopie: number;
    }, any>,
  });

  const dataAddestramenti = useFetchAddestramenti();
  const creazioneTipiDiExport = useMutation({
    mutationFn: async (data: TipiDiExportAttributes & { is_modifica: boolean }) => {
      const result = await ServerCall.put<TipiDiExportAttributes>("/creaTipoExport", data);
      return result;
    },
    mutationKey: ["creaTipoExport"],
    onSuccess: async () => {
      showNotification("Tipo di export creato con successo", { variant: "success" });
      if (refPannelloTipiExport.current) {
        refPannelloTipiExport.current?.refetchTipiExport();
      }
    },
    onError: async (error) => {
      showNotification(`Errore durante il salvataggio del tipo di export: ${error.message}`, { variant: "error" });
      revalidator.revalidate();
      if (refPannelloTipiExport.current) {
        refPannelloTipiExport.current?.refetchTipiExport();
      }
    }
  });

  const creazioneFormati = useMutation({
    mutationFn: async (data: FormatiResponseDTO) => {
      const result = await ServerCall.put<ServerResponse<FormatiResponseDTO>>("/salvaFormato", data);
      return result;
    },
    mutationKey: ["salvaFormato"],
    onSuccess: async (result) => {
      if (refPannelloFormati) {
        refPannelloFormati.current?.refetchFormati();
      }

      if (result.esito && result.data) {
        showNotification(
          result.isUpdate ? "Formato aggiornato con successo" : "Formato creato con successo",
          { variant: "success" }
        );
        revalidator.revalidate();
      }
    },
    onError: async (error) => {
      console.error(error);
      if (refPannelloFormati) {
        refPannelloFormati.current?.refetchFormati();
      }
      revalidator.revalidate();
      showNotification(`Errore durante il salvataggio del formato: ${error.message}`, { variant: "error" });
    }
  })

  const creazioneNamingConvention = useMutation({
    mutationFn: async (data: {
      namingConvention: {
        id: string,
        nome: string,
        descrizione: string,
        nomeVisual: string
      }[]
      nome: string,
      descrizione: string,
      id_naming_convention?: string,
    }) => {
      const result = await ServerCall.put<ServerResponse<any>>("/creaNamingConvention", data);
      return result;
    },
    mutationKey: ["creaNamingConvention"],
    onSuccess: async (result) => {
      if (result.esito && result.data) {
        showNotification(
          result.isUpdate ? "Naming convention aggiornata con successo" : "Naming convention creata con successo",
          { variant: "success" }
        );
        revalidator.revalidate();
      }
      refPannelloNamingConvention.current?.refetchNamingConventions();
      datiNamingConvention.refetch();
      setNamingConvention([]);

      // Reset dello stato di modifica
      setIsModificaNamingConvention(false);
      setNamingConventionDaModificare(null);
      setNomeNamingConvention('');
      setDescrizioneNamingConvention('');
      setNamingConventionData([]);
    },
    onError: async (error) => {
      revalidator.revalidate();
      showNotification(`Errore durante il salvataggio della naming convention: ${error.message}`, { variant: "error" });
      datiNamingConvention.refetch();
    }
  });


  const datiNamingConvention = useFetchDatiNamingConventionFromIstanta();
  const dataNamingConventionLocali = useFetchNamingConventions();

  const handleCreazioneTipiExport: SubmitHandler<TipiDiExportAttributes> = (data) => {
    // Converte la modalità da stringa a enum se necessario
    const modalitaValue = (data.modalita_tipiexport as any);
    const processedData: TipiDiExportAttributes & { is_modifica: boolean } = {
      ...data,
      modalita_tipiexport: (modalitaValue && modalitaValue !== "")
        ? modalitaValue as MODALITA_TIPO_EXPORT
        : undefined,
      guid_namingconvention_tipiexport: (data.guid_namingconvention_tipiexport && data.guid_namingconvention_tipiexport !== "")
        ? data.guid_namingconvention_tipiexport
        : undefined,
      is_modifica: false
    };

    setShowDialogCreazioneTipiExport(false);
    creazioneTipiDiExport.mutate(processedData);
    reset({
      nome_tipiexport: '',
      codice_tipiexport: '',
      modalita_tipiexport: undefined,
      guid_namingconvention_tipiexport: '',
      filtri_tipiexport: []
    });
  };

  const handleCloseDialogCreazioneTipiExport = () => {
    setShowDialogCreazioneTipiExport(false);
    reset({
      nome_tipiexport: '',
      codice_tipiexport: '',
      modalita_tipiexport: undefined,
      guid_namingconvention_tipiexport: '',
      filtri_tipiexport: []
    });

  };

  const handleCloseCreaCombinazioni = () => {
    setShowDialogCreazioneCombinazioni(false);
  }

  const handleCreazioneFormati: SubmitHandler<FormatiResponseDTO> = (data) => {
    setShowDialogCreazioneFormati(false);
    creazioneFormati.mutate(data);
    resetFormati();

  };

  const handleCloseDialogCreazioneFormati = () => {
    setShowDialogCreazioneFormati(false);
    resetFormati();
  };


  const handleChange = useCallback((result: any) => {
    setNamingConvention(result);
    if (isModificaNamingConvention) {
      setNamingConventionData(result);
    }
  }, [isModificaNamingConvention]);

  const handleEditNamingConvention = (convention: any) => {
    setNamingConventionDaModificare(convention);
    setNomeNamingConvention(convention.nome || '');
    setDescrizioneNamingConvention(convention.descrizione || '');

    // Converti gli ID salvati in oggetti Option completi
    const selectedOptions = (convention.fields || []).map((id: any) => {
      // Cerca l'opzione corrispondente nelle opzioni disponibili
      const availableOption = datiNamingConvention.data?.find(option => option.id === id);
      if (availableOption) {
        return availableOption;
      }
      // Se non trova l'opzione (potrebbe essere una parola custom), crea un oggetto temporaneo
      return {
        id,
        nome: id,
        descrizione: 'Custom word',
        nomeVisual: id
      };
    });

    setNamingConventionData(selectedOptions);
    setIsModificaNamingConvention(true);
    setShowDialogCreazioneNamingConvention(true);

    // Imposta le opzioni selezionate nel componente dopo che si è aperto
    setTimeout(() => {
      if (refNamingConvention.current) {
        refNamingConvention.current.setSelectedOptions(selectedOptions);
      }
    }, 100);
  };

  const handleEditTemplate = (data: {
    guidId: string;
    titolo: string;
    filtro: any[];
    declinazioni: any[];
    tipiDiExportInKit: any[];
    quantita: number;
    quantitaKit: number;
    codiceFormato: string;
  }) => {
    // Nessuna azione: la modifica del template avviene dalla pagina di dettaglio
    void data;
  }

  const chiudiDialogNamingConvention = () => {
    setShowDialogCreazioneNamingConvention(false);
    setIsModificaNamingConvention(false);
    setNamingConventionDaModificare(null);
    setNomeNamingConvention('');
    setDescrizioneNamingConvention('');
    setNamingConvention([]);
    setNamingConventionData([]);
  };

  // Opzioni comuni ai dialog dei tipi di export
  const opzioniModalita = Object.keys(MODALITA_TIPO_EXPORT).map((key, index) => (
    <option key={index} value={MODALITA_TIPO_EXPORT[key as keyof typeof MODALITA_TIPO_EXPORT]}>{key.replace(/_/g, " ")}</option>
  ));
  const opzioniNamingConvention = dataNamingConventionLocali?.data?.map((namingConvention: { id: string; nome: string }, index: number) => (
    <option key={index} value={namingConvention.id}>{namingConvention.nome}</option>
  ));

  return (
    <>
      <Dialog size="md" open={showDialogCreazioneFormati} onClose={handleCloseDialogCreazioneFormati}>
        <Dialog.Panel>
          <Dialog.Title>Crea formato</Dialog.Title>
          <form onSubmit={handleSubmitFormati(handleCreazioneFormati)}>
            <Dialog.Description className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FormField etichetta="Nome" obbligatorio errore={errorsFormati.nome?.message}>
                <FormInput placeholder="Nome" id="nome_formato" {...registerFormati("nome")} />
              </FormField>
              <FormField etichetta="Codice" obbligatorio errore={errorsFormati.codice?.message}>
                <FormInput placeholder="Codice" id="codice_formato" {...registerFormati("codice")} />
              </FormField>
              <FormField className="col-span-2" etichetta="Descrizione" obbligatorio errore={errorsFormati.descrizione?.message}>
                <FormTextarea placeholder="Descrizione" id="descrizione_formato" {...registerFormati("descrizione")} />
              </FormField>
              <FormField className="col-span-2" etichetta="Tipo di formato" obbligatorio errore={errorsFormati.tipo_lavorazione?.message}>
                <FormSelect id="tipi_formato" defaultValue={0} {...registerFormati("tipo_lavorazione")}>
                  <option value="">Seleziona un tipo</option>
                  {Object.keys(TIPO_LAVORAZIONE)
                    .filter(key => !isNaN(Number(key))) // Filtra le chiavi numeriche
                    .map((key, index) => {
                      const tipo = TIPO_LAVORAZIONE[key as keyof typeof TIPO_LAVORAZIONE];
                      return <option key={index} value={TIPO_LAVORAZIONE[tipo]}>{tipo}</option>;
                    })}
                </FormSelect>
              </FormField>
            </Dialog.Description>
            <Dialog.Footer>
              <Button type="button" variant="outline-secondary" onClick={handleCloseDialogCreazioneFormati}>Annulla</Button>
              <Button variant="primary" type="submit" loading={creazioneFormati.isPending} disabled={creazioneFormati.isPending}>Crea</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Panel>
      </Dialog>
      <Dialog size="xl" open={showDialogCreazioneTipiExport} onClose={handleCloseDialogCreazioneTipiExport}>
        <Dialog.Panel>
          <Dialog.Title>Crea tipo di export</Dialog.Title>
          <form onSubmit={handleSubmit(handleCreazioneTipiExport)}>
            <Dialog.Description className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FormField etichetta="Nome export" obbligatorio errore={errors.nome_tipiexport?.message}>
                <FormInput placeholder="Nome" id="nome_export" {...register("nome_tipiexport")} />
              </FormField>
              <FormField etichetta="Codice" obbligatorio errore={errors.codice_tipiexport?.message}>
                <FormInput placeholder="Codice" id="descrizione_export" {...register("codice_tipiexport")} />
              </FormField>
              <FormField etichetta="Modalità" errore={errors.modalita_tipiexport?.message}>
                <FormSelect id="modalita_export" defaultValue={""} {...register("modalita_tipiexport")}>
                  <option value="">Seleziona una modalità</option>
                  {opzioniModalita}
                </FormSelect>
              </FormField>
              <FormField etichetta="Naming convention" errore={errors.guid_namingconvention_tipiexport?.message}>
                <FormSelect id="guid_naming_convention" {...register("guid_namingconvention_tipiexport")}>
                  <option value="">Seleziona una naming convention</option>
                  {opzioniNamingConvention}
                </FormSelect>
              </FormField>
              <div className="col-span-2">
                <FilterBaseForm
                  control={control}
                  register={register}
                  errors={errors}
                  dataAddestramenti={dataAddestramenti.data}
                  namePrefix="filtri_tipiexport"
                />
              </div>
            </Dialog.Description>
            <Dialog.Footer>
              <Button type="button" variant="outline-secondary" onClick={handleCloseDialogCreazioneTipiExport}>Annulla</Button>
              <Button variant="primary" type="submit" loading={creazioneTipiDiExport.isPending} disabled={creazioneTipiDiExport.isPending}>Crea</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Panel>
      </Dialog>
      <Dialog size="xl" open={showDialogModificaTipiExport} onClose={handleCloseDialogModificaTipiExport}>
        <Dialog.Panel>
          <Dialog.Title>Modifica tipo di export</Dialog.Title>
          <form onSubmit={handleSubmitEdit(handleModificaTipiExport)}>
            <Dialog.Description className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FormField etichetta="Nome export" obbligatorio errore={errorsEdit.nome_tipiexport?.message}>
                <FormInput placeholder="Nome" id="nome_export_edit" {...registerEdit("nome_tipiexport")} />
              </FormField>
              <FormField etichetta="Codice" obbligatorio errore={errorsEdit.codice_tipiexport?.message}>
                <FormInput placeholder="Codice" id="descrizione_export_edit" {...registerEdit("codice_tipiexport")} />
              </FormField>
              <FormField etichetta="Modalità" errore={errorsEdit.modalita_tipiexport?.message}>
                <FormSelect id="modalita_export_edit" defaultValue={""} {...registerEdit("modalita_tipiexport")}>
                  <option value="">Seleziona una modalità</option>
                  {opzioniModalita}
                </FormSelect>
              </FormField>
              <FormField etichetta="Naming convention" errore={errorsEdit.guid_namingconvention_tipiexport?.message}>
                <FormSelect id="guid_naming_convention_edit" {...registerEdit("guid_namingconvention_tipiexport")}>
                  <option value="">Seleziona una naming convention</option>
                  {opzioniNamingConvention}
                </FormSelect>
              </FormField>
              <div className="col-span-2">
                <FilterBaseForm
                  control={controlEdit}
                  register={registerEdit}
                  errors={errorsEdit}
                  dataAddestramenti={dataAddestramenti.data}
                  namePrefix="filtri_tipiexport"
                />
              </div>
            </Dialog.Description>
            <Dialog.Footer>
              <Button type="button" variant="outline-secondary" onClick={handleCloseDialogModificaTipiExport}>Annulla</Button>
              <Button variant="primary" type="submit" loading={isSubmittingEdit} disabled={isSubmittingEdit}>Salva</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Panel>
      </Dialog>
      <Dialog size="xl" open={showDialogCreazioneNamingConvention} onClose={chiudiDialogNamingConvention}>
        <Dialog.Panel>
          <Dialog.Title>{isModificaNamingConvention ? 'Modifica naming convention' : 'Crea naming convention'}</Dialog.Title>
          <Dialog.Description className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <FormField etichetta="Nome">
                <FormInput value={nomeNamingConvention} onChange={(e) => { setNomeNamingConvention(e.target.value) }} placeholder="Nome" id="nome_naming" />
              </FormField>
              <FormField etichetta="Descrizione">
                <FormInput value={descrizioneNamingConvention} onChange={(e) => { setDescrizioneNamingConvention(e.target.value) }} placeholder="Descrizione" id="descrizione_naming" />
              </FormField>
            </div>
            <NamingConvention
              ref={refNamingConvention}
              data={datiNamingConvention.data ?? []}
              onChange={handleChange}
            />
          </Dialog.Description>
          <Dialog.Footer>
            <Button variant="outline-secondary" onClick={chiudiDialogNamingConvention} disabled={creazioneNamingConvention.isPending}>Annulla</Button>
            <Button
              variant="primary"
              loading={creazioneNamingConvention.isPending}
              disabled={creazioneNamingConvention.isPending}
              onClick={() => {
                creazioneNamingConvention.mutate({
                  namingConvention,
                  nome: nomeNamingConvention,
                  descrizione: descrizioneNamingConvention,
                  id_naming_convention: isModificaNamingConvention ? namingConventionDaModificare?.id : undefined
                }, {
                  // Il dialog resta aperto, col pulsante in caricamento, fino alla risposta
                  onSettled: () => setShowDialogCreazioneNamingConvention(false),
                })
              }}
            >
              {isModificaNamingConvention ? 'Salva' : 'Crea'}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <Pagina
        titolo="Impostazioni di Produzione"
        descrizione="Pannello di controllo per la configurazione di formati, export e combinazioni."
      >
        {/* Combinazioni */}
        <Sezione
          icona="Layers"
          titolo="Combinazioni"
          descrizione="Template dei kit e combinazioni di produzione"
          azioni={
            <>
              <Button size="sm" variant="outline-secondary" onClick={() => navigate('/impostazioni-di-produzione/creazione-kit-manuale')}>
                <Lucide icon="Package" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Kit manuale
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={() => navigate('/impostazioni-di-produzione/creazione-kit-automatico')}>
                <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Nuovo kit automatico
              </Button>
            </>
          }
        >
          <PanelCombinazioni ref={refPanelCombinazioni} callbackEditaTemplate={handleEditTemplate} />
        </Sezione>

        {/* Formati */}
        <Sezione
          senzaPadding
          icona="LayoutTemplate"
          titolo="Formati"
          azioni={
            <PermissionGate permission={PERMISSIONS.IMPOSTAZIONI.GESTISCI_FORMATI} mode="disable">
              <Button size="sm" variant="outline-secondary" onClick={() => setShowDialogCreazioneFormati(true)}>
                <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Nuovo formato
              </Button>
            </PermissionGate>
          }
        >
          <PanelFormati ref={refPannelloFormati} />
        </Sezione>

        {/* Tipi di Export */}
        <Sezione
          senzaPadding
          icona="FileOutput"
          titolo="Tipi di export"
          azioni={
            <PermissionGate permission={PERMISSIONS.IMPOSTAZIONI.GESTISCI_TIPO_EXPORT} mode="disable">
              <Button size="sm" variant="outline-secondary" onClick={() => setShowDialogCreazioneTipiExport(true)}>
                <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Nuovo tipo
              </Button>
            </PermissionGate>
          }
        >
          <PanelTipiExport ref={refPannelloTipiExport} onEditTipoExport={(data) => {
            openDialogModificaTipiExport({
              id: data.id || '',
              nome_tipiexport: data.nome || '',
              codice_tipiexport: data.codice || '',
              guid_namingconvention_tipiexport: data.guid_namingconvention,
              modalita_tipiexport: data.modalita,
              filtri_tipiexport: data.filtri || [],
            })
          }} />
        </Sezione>

        {/* Naming Convention */}
        <Sezione
          senzaPadding
          icona="FileText"
          titolo="Naming convention"
          azioni={
            <PermissionGate permission={PERMISSIONS.IMPOSTAZIONI.GESTISCI_NAMING_CONVENTION} mode="disable">
              <Button size="sm" variant="outline-secondary" onClick={() => setShowDialogCreazioneNamingConvention(true)}>
                <Lucide icon="Plus" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Nuova convention
              </Button>
            </PermissionGate>
          }
        >
          <PanelNamingConvention ref={refPannelloNamingConvention} onEditNamingConvention={handleEditNamingConvention} />
        </Sezione>

        {/* Schemi di Momenti */}
        <Sezione icona="GitCompare" titolo="Schemi di momenti">
          <GestioneSchemi />
        </Sezione>

        {/* Funzionalità della GDO */}
        <Sezione icona="ToggleRight" titolo="Funzionalità">
          <PanelFunzionalita />
        </Sezione>

        {/* Menabò */}
        <Sezione icona="LayoutList" titolo="Menabò">
          <PanelMenabo />
        </Sezione>
      </Pagina>
    </>
  );
}

export default withSessionCheck(Main);
