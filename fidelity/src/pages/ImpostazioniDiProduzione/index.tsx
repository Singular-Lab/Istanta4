import { FormInput, FormLabel, FormSelect, FormTextarea } from "@/components/Base/Form";
import { Dialog, Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";

import Button from "@/components/Base/Button";
import GestioneSchemi from "@/pages/LavorazioniInCorso/DettagliLavorazioneInCorso/GestioneSchemi";
import PanelCombinazioni from "@/pages/ImpostazioniDiProduzione/PanelCombinazioni";
import PanelFormati from "@/pages/ImpostazioniDiProduzione/PanelFormati";
import PanelMenabo from "@/pages/ImpostazioniDiProduzione/PanelMenabo";
import PanelNamingConvention from "@/pages/ImpostazioniDiProduzione/PanelNamingConvention";
import PanelTipiExport from "@/pages/ImpostazioniDiProduzione/PanelTipiExport";
import React, { useCallback, useRef, useState } from "react";
import { useLocation, useNavigate, useRevalidator } from "react-router-dom";

// Tipi di export per modifica
type TipiExportEditState = TipiDiExportAttributes & { id?: string };

import FilterBaseForm from '@/components/Base/FormFiltriDesign';
import PageHeader from "@/components/Base/PageHeader";
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
  tipo_lavorazione: yup.number().required('Il tipo di lavorazione è obbligatorio').oneOf([1, 2], 'Seleziona un tipo di lavorazione valido'),
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
  const { register: registerEdit, handleSubmit: handleSubmitEdit, formState: { errors: errorsEdit }, reset: resetEdit, control: controlEdit } = useForm<TipiDiExportAttributes>({
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
    // Chiamata API update con ID
    ServerCall.put<TipiDiExportAttributes & { id?: string }>(`/creaTipoExport`, processedData)
      .then(() => {
        setShowDialogModificaTipiExport(false);
        setTipiExportEdit(null);
        if (refPannelloTipiExport.current) refPannelloTipiExport.current?.refetchTipiExport();
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Tipo di export modificato con successo</div>
            </div>
          </div>
        );
        revalidator.revalidate();
      })
      .catch((error) => {
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Errore durante la modifica</div>
              <div className="mt-1 text-slate-500">{error.message}</div>
            </div>
          </div>
        );
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
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Creazione tipo di export avvenuta con successo</div>
            <div className="mt-1 text-slate-500">
              Il tipo di export è stato creato correttamente.
            </div>
          </div>
        </div>
      );
      console.log("Refetching tipi export", refPannelloTipiExport.current);
      if (refPannelloTipiExport.current) {
        refPannelloTipiExport.current?.refetchTipiExport();
      }
    },
    onError: async (error) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'aggiornamento del raccoglitore</div>
            <div className="mt-1 text-slate-500">
              {error.message}
            </div>
          </div>
        </div>
      );
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
      console.log(refPannelloFormati)
      if (refPannelloFormati) {
        refPannelloFormati.current?.refetchFormati();
      }

      if (result.esito && result.data) {
        const message = result.isUpdate
          ? "Formato aggiornato con successo"
          : "Formato creato con successo";
        const icon = result.isUpdate ? "CircleCheck" : "CircleCheck";
        const iconColor = result.isUpdate ? "text-success" : "text-success";

        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon={icon} className={`${iconColor} w-8 h-8`} />
            <div className="ml-4 mr-4">
              <div className="font-bold">{message}</div>
              <div className="mt-1 text-slate-500">
                Il formato è stato {result.isUpdate ? 'aggiornato' : 'creato'} correttamente.
              </div>
            </div>
          </div>
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
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'aggiornamento del raccoglitore</div>
            <div className="mt-1 text-slate-500">
              {error.message}
            </div>
          </div>
        </div>
      );
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
        const message = result.isUpdate
          ? "Naming convention aggiornata con successo"
          : "Naming convention creata con successo";
        const icon = result.isUpdate ? "CircleCheck" : "CircleCheck";
        const iconColor = result.isUpdate ? "text-success" : "text-success";

        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon={icon} className={`${iconColor} w-8 h-8`} />
            <div className="ml-4 mr-4">
              <div className="font-bold">{message}</div>
              <div className="mt-1 text-slate-500">
                La naming convention è stata {result.isUpdate ? 'aggiornata' : 'creata'} correttamente.
              </div>
            </div>
          </div>
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
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'aggiornamento del raccoglitore</div>
            <div className="mt-1 text-slate-500">
              {error.message}
            </div>
          </div>
        </div>
      );
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

    console.log("Raw form data:", data);
    console.log("Processed data:", processedData);
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
    console.log(result);
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
    console.log(data);
  }

  return (
    <>

      <Dialog size="md" open={showDialogCreazioneFormati} onClose={handleCloseDialogCreazioneFormati}>
        <Dialog.Panel>
          <Dialog.Title >
            <h2 className="mr-auto text-base font-medium">
              Crea Formato
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <form onSubmit={handleSubmitFormati(handleCreazioneFormati)}>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <div className="col-span-1">
                  <FormLabel htmlFor="nome_formato">Nome</FormLabel>
                  <FormInput placeholder="Nome" id="nome_formato" {...registerFormati("nome")} />
                  {errorsFormati.nome && <p className="text-red-500">{errorsFormati.nome.message}</p>}
                </div>
                <div className="col-span-1">
                  <FormLabel htmlFor="codice_formato">Codice</FormLabel>
                  <FormInput placeholder="Codice" id="codice_formato" {...registerFormati("codice")} />
                  {errorsFormati.codice && <p className="text-red-500">{errorsFormati.codice.message}</p>}
                </div>
                <div className="col-span-2">
                  <FormLabel htmlFor="descrizione_formato">Descrizione</FormLabel>
                  <FormTextarea placeholder="Descrizione" id="descrizione_formato" {...registerFormati("descrizione")} />
                  {errorsFormati.descrizione && <p className="text-red-500">{errorsFormati.descrizione.message}</p>}
                </div>
                <div className="col-span-2">
                  <FormLabel htmlFor="tipi_formato">Tipi di formato</FormLabel>
                  <FormSelect id="tipi_formato" defaultValue={0} {...registerFormati("tipo_lavorazione")}>
                    <option value="">Seleziona un tipo</option>
                    {Object.keys(TIPO_LAVORAZIONE)
                      .filter(key => !isNaN(Number(key))) // Filtra le chiavi numeriche
                      .map((key, index) => {
                        const tipo = TIPO_LAVORAZIONE[key as keyof typeof TIPO_LAVORAZIONE];
                        return <option key={index} value={TIPO_LAVORAZIONE[tipo]}>{tipo}</option>;
                      })}
                  </FormSelect>
                  {errorsFormati.tipo_lavorazione && <p className="text-red-500">{errorsFormati.tipo_lavorazione.message}</p>}
                </div>
              </div>
              <Dialog.Footer>
                <div className="flex flex-row justify-end gap-x-3">
                  <Button variant="secondary" onClick={handleCloseDialogCreazioneFormati}>Annulla</Button>
                  <Button variant="primary" type="submit">Crea</Button>
                </div>
              </Dialog.Footer>
            </form>
          </Dialog.Description>
        </Dialog.Panel>
      </Dialog>
      <Dialog size="xl" open={showDialogCreazioneTipiExport} onClose={handleCloseDialogCreazioneTipiExport}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              Crea Tipo di Export
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <form onSubmit={handleSubmit(handleCreazioneTipiExport)}>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                <div className="col-span-1">
                  <FormLabel htmlFor="nome_export">Nome Export</FormLabel>
                  <FormInput placeholder="Nome" id="nome_export" {...register("nome_tipiexport")} />
                  {errors.nome_tipiexport && <p className="text-red-500">{errors.nome_tipiexport.message}</p>}
                </div>
                <div className="col-span-1">
                  <FormLabel htmlFor="descrizione_export">Codice</FormLabel>
                  <FormInput placeholder="Descrizione" id="descrizione_export" {...register("codice_tipiexport")} />
                  {errors.codice_tipiexport && <p className="text-red-500">{errors.codice_tipiexport.message}</p>}
                </div>
                <div className="col-span-1">
                  <FormLabel htmlFor="modalita_export">Modalità</FormLabel>
                  <FormSelect id="modalita_export" defaultValue={""} {...register("modalita_tipiexport")}>
                    <option value="">Seleziona una modalità</option>
                    {Object.keys(MODALITA_TIPO_EXPORT).map((key, index) => {
                      return <option key={index} value={MODALITA_TIPO_EXPORT[key as keyof typeof MODALITA_TIPO_EXPORT]}>{key.replace(
                        /_/g,
                        " "
                      )}</option>;
                    })}
                  </FormSelect>
                  {errors.modalita_tipiexport && <p className="text-red-500">{errors.modalita_tipiexport.message}</p>}
                </div>
                <div className="col-span-1">
                  <FormLabel htmlFor="guid_naming_convention" >Naming Convention</FormLabel>
                  <FormSelect id="guid_naming_convention" {...register("guid_namingconvention_tipiexport")}>
                    <option value="">Seleziona una naming convention</option>
                    {dataNamingConventionLocali?.data?.map((namingConvention: { id: string | number | readonly string[] | undefined; nome: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Iterable<React.ReactNode> | null | undefined; }, index: React.Key | null | undefined) => (
                      <option key={index} value={namingConvention.id}>{namingConvention.nome}</option>
                    ))}
                  </FormSelect>
                  {errors.guid_namingconvention_tipiexport && <p className="text-red-500">{errors.guid_namingconvention_tipiexport.message}</p>}
                </div>
                <div className="col-span-2">
                  <FilterBaseForm
                    control={control}
                    register={register}
                    errors={errors}
                    dataAddestramenti={dataAddestramenti.data}
                    namePrefix="filtri_tipiexport"
                  />
                </div>
              </div>
              <Dialog.Footer>
                <div className="flex flex-row justify-end gap-x-3">
                  <Button variant="secondary" onClick={handleCloseDialogCreazioneTipiExport}>Annulla</Button>
                  <Button variant="primary" type="submit">Crea</Button>
                </div>
              </Dialog.Footer>
            </form>
          </Dialog.Description>
        </Dialog.Panel>
      </Dialog>
      <Dialog size="xl" open={showDialogCreazioneNamingConvention} onClose={() => {
        setShowDialogCreazioneNamingConvention(false);
        setIsModificaNamingConvention(false);
        setNamingConventionDaModificare(null);
        setNomeNamingConvention('');
        setDescrizioneNamingConvention('');
        setNamingConvention([]);
        setNamingConventionData([]);
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              {isModificaNamingConvention ? 'Modifica Naming Convention' : 'Crea Naming Convention'}
            </h2>
          </Dialog.Title>
          <Dialog.Description>
            <div className="grid grid-cols-2 p-4 gap-y-3 gap-x-6">
              <div className="col-span-1">
                <FormLabel htmlFor="nome_naming">Nome</FormLabel>
                <FormInput value={nomeNamingConvention} onChange={(e) => { setNomeNamingConvention(e.target.value) }} placeholder="Nome" id="nome_naming" />
              </div>
              <div className="col-span-1">
                <FormLabel htmlFor="descrizione_naming">Descrizione</FormLabel>
                <FormInput value={descrizioneNamingConvention} onChange={(e) => { setDescrizioneNamingConvention(e.target.value) }} placeholder="Descrizione" id="descrizione_naming" />
              </div>
            </div>
            <NamingConvention
              ref={refNamingConvention}
              data={datiNamingConvention.data ?? []}
              onChange={handleChange}
            />
          </Dialog.Description>
          <Dialog.Footer>
            <div className="flex flex-row justify-between gap-x-3">
              <Button variant="secondary" onClick={() => {
                setShowDialogCreazioneNamingConvention(false);
                setIsModificaNamingConvention(false);
                setNamingConventionDaModificare(null);
                setNomeNamingConvention('');
                setDescrizioneNamingConvention('');
                setNamingConvention([]);
                setNamingConventionData([]);
              }}>Annulla</Button>
              <Button variant="primary" onClick={() => {
                setShowDialogCreazioneNamingConvention(false);
                creazioneNamingConvention.mutate({
                  namingConvention,
                  nome: nomeNamingConvention,
                  descrizione: descrizioneNamingConvention,
                  id_naming_convention: isModificaNamingConvention ? namingConventionDaModificare?.id : undefined
                })
              }}>
                {isModificaNamingConvention ? 'Salva' : 'Crea'}
              </Button>
            </div>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <div className="flex items-center justify-between">
        <PageHeader
          title="Impostazioni di Produzione"
          description="Pannello di controllo per la configurazione di formati, export e combinazioni."
        />
        <Popover>
          <Popover.Button
            as={Button}
            variant="primary"
            className="shadow-lg"
          >
            <Lucide icon="Plus" className="w-4 h-4 mr-2" />
            Crea Nuovo
            <Lucide icon="ChevronDown" className="w-4 h-4 ml-2" />
          </Popover.Button>
          <Popover.Panel className="w-60 mt-1">
            <PermissionGate permission={PERMISSIONS.IMPOSTAZIONI.GESTISCI_FORMATI} mode="disable">
              <div
                className="cursor-pointer p-3 hover:bg-slate-100 flex items-center rounded-lg"
                onClick={() => { setShowDialogCreazioneFormati(true); }}
              >
                <Lucide icon="LayoutTemplate" className="w-5 h-5 mr-3" />
                <div>
                  <div className="font-medium">Formato</div>
                  <div className="text-xs text-slate-500">Crea nuovo formato</div>
                </div>
              </div>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.IMPOSTAZIONI.GESTISCI_TIPO_EXPORT} mode="disable">
              <div
                className="cursor-pointer p-3 hover:bg-slate-100 flex items-center rounded-lg"
                onClick={() => { setShowDialogCreazioneTipiExport(true); }}
              >
                <Lucide icon="FileOutput" className="w-5 h-5 mr-3" />
                <div>
                  <div className="font-medium">Tipo di Export</div>
                  <div className="text-xs text-slate-500">Crea tipo di export</div>
                </div>
              </div>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.IMPOSTAZIONI.GESTISCI_NAMING_CONVENTION} mode="disable">
              <div
                className="cursor-pointer p-3 hover:bg-slate-100 flex items-center rounded-lg"
                onClick={() => { setShowDialogCreazioneNamingConvention(true); }}
              >
                <Lucide icon="FileText" className="w-5 h-5 mr-3" />
                <div>
                  <div className="font-medium">Naming Convention</div>
                  <div className="text-xs text-slate-500">Crea naming convention</div>
                </div>
              </div>
            </PermissionGate>
            <hr className="my-2" />
            <div
              className="cursor-pointer p-3 hover:bg-slate-100 flex items-center rounded-lg"
              onClick={() => { navigate('/impostazioni-di-produzione/creazione-kit-automatico'); }}
            >
              <Lucide icon="Cog" className="w-5 h-5 mr-3" />
              <div>
                <div className="font-medium">Kit Automatico</div>
                <div className="text-xs text-slate-500">Crea kit automatico</div>
              </div>
            </div>
            <div
              className="cursor-pointer p-3 hover:bg-slate-100 flex items-center rounded-lg"
              onClick={() => { navigate('/impostazioni-di-produzione/creazione-kit-manuale'); }}
            >
              <Lucide icon="Package" className="w-5 h-5 mr-3" />
              <div>
                <div className="font-medium">Kit Manuale</div>
                <div className="text-xs text-slate-500">Crea kit manuale</div>
              </div>
            </div>
          </Popover.Panel>
        </Popover>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-8">
        {/* Combinazioni */}
        <div className="col-span-1 lg:col-span-2 p-5 box box--stacked">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <Lucide icon="Layers" className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-800">Combinazioni</h2>
            </div>
            <Button size="sm" onClick={() => navigate('/impostazioni-di-produzione/creazione-kit-automatico')} variant='outline-primary'>
              <Lucide icon="Plus" className="w-4 h-4 mr-2" /> Nuovo Kit
            </Button>
          </div>
          <PanelCombinazioni ref={refPanelCombinazioni} callbackEditaTemplate={handleEditTemplate} />
        </div>

        {/* Formati */}
        <div className="col-span-1 lg:col-span-2 p-5 box box--stacked">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <Lucide icon="LayoutTemplate" className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-800">Formati</h2>
            </div>
            <Button size="sm" onClick={() => setShowDialogCreazioneFormati(true)} variant='outline-primary'>
              <Lucide icon="Plus" className="w-4 h-4 mr-2" /> Nuovo Formato
            </Button>
          </div>
          <PanelFormati ref={refPannelloFormati} />
        </div>

        {/* Tipi di Export */}
        <div className="col-span-1 lg:col-span-2 p-5 box box--stacked">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <Lucide icon="FileOutput" className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-800">Tipi di Export</h2>
            </div>
            <Button size="sm" onClick={() => setShowDialogCreazioneTipiExport(true)} variant='outline-primary'>
              <Lucide icon="Plus" className="w-4 h-4 mr-2" /> Nuovo Tipo
            </Button>
          </div>
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
          {/* Dialog Modifica Tipi di Export */}
          <Dialog size="xl" open={showDialogModificaTipiExport} onClose={handleCloseDialogModificaTipiExport}>
            <Dialog.Panel>
              <Dialog.Title>
                <h2 className="mr-auto text-base font-medium">
                  Modifica Tipo di Export
                </h2>
              </Dialog.Title>
              <Dialog.Description>
                <form onSubmit={handleSubmitEdit(handleModificaTipiExport)}>
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    <div className="col-span-1">
                      <FormLabel htmlFor="nome_export_edit">Nome Export</FormLabel>
                      <FormInput placeholder="Nome" id="nome_export_edit" {...registerEdit("nome_tipiexport")} />
                      {errorsEdit.nome_tipiexport && <p className="text-red-500">{errorsEdit.nome_tipiexport.message}</p>}
                    </div>
                    <div className="col-span-1">
                      <FormLabel htmlFor="descrizione_export_edit">Codice</FormLabel>
                      <FormInput placeholder="Descrizione" id="descrizione_export_edit" {...registerEdit("codice_tipiexport")} />
                      {errorsEdit.codice_tipiexport && <p className="text-red-500">{errorsEdit.codice_tipiexport.message}</p>}
                    </div>
                    <div className="col-span-1">
                      <FormLabel htmlFor="modalita_export_edit">Modalità</FormLabel>
                      <FormSelect id="modalita_export_edit" defaultValue={""} {...registerEdit("modalita_tipiexport")}>
                        <option value="">Seleziona una modalità</option>
                        {Object.keys(MODALITA_TIPO_EXPORT).map((key, index) => {
                          return <option key={index} value={MODALITA_TIPO_EXPORT[key as keyof typeof MODALITA_TIPO_EXPORT]}>{key.replace(/_/g, " ")}</option>;
                        })}
                      </FormSelect>
                      {errorsEdit.modalita_tipiexport && <p className="text-red-500">{errorsEdit.modalita_tipiexport.message}</p>}
                    </div>
                    <div className="col-span-1">
                      <FormLabel htmlFor="guid_naming_convention_edit" >Naming Convention</FormLabel>
                      <FormSelect id="guid_naming_convention_edit" {...registerEdit("guid_namingconvention_tipiexport")}>
                        <option value="">Seleziona una naming convention</option>
                        {dataNamingConventionLocali?.data?.map((namingConvention: { id: string | number | readonly string[] | undefined; nome: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | Iterable<React.ReactNode> | null | undefined; }, index: React.Key | null | undefined) => (
                          <option key={index} value={namingConvention.id}>{namingConvention.nome}</option>
                        ))}
                      </FormSelect>
                      {errorsEdit.guid_namingconvention_tipiexport && <p className="text-red-500">{errorsEdit.guid_namingconvention_tipiexport.message}</p>}
                    </div>
                    <div className="col-span-2">
                      <FilterBaseForm
                        control={controlEdit}
                        register={registerEdit}
                        errors={errorsEdit}
                        dataAddestramenti={dataAddestramenti.data}
                        namePrefix="filtri_tipiexport"
                      />
                    </div>
                  </div>
                  <Dialog.Footer>
                    <div className="flex flex-row justify-end gap-x-3">
                      <Button variant="secondary" onClick={handleCloseDialogModificaTipiExport}>Annulla</Button>
                      <Button variant="primary" type="submit">Salva</Button>
                    </div>
                  </Dialog.Footer>
                </form>
              </Dialog.Description>
            </Dialog.Panel>
          </Dialog>
        </div>

        {/* Naming Convention */}
        <div className="col-span-1 lg:col-span-2 p-5 box box--stacked">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <Lucide icon="FileText" className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-800">Naming Convention</h2>
            </div>
            <Button size="sm" onClick={() => setShowDialogCreazioneNamingConvention(true)} variant='outline-primary'>
              <Lucide icon="Plus" className="w-4 h-4 mr-2" /> Nuova Convention
            </Button>
          </div>
          <PanelNamingConvention ref={refPannelloNamingConvention} onEditNamingConvention={handleEditNamingConvention} />
        </div>

        {/* Schemi di Momenti */}
        <div className="col-span-1 lg:col-span-2 p-5 box box--stacked">
          <div className="flex items-center pb-4 mb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <Lucide icon="GitCompare" className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-800">Schemi di Momenti</h2>
            </div>
          </div>
          <GestioneSchemi />
        </div>

        {/* Menabò */}
        <div className="col-span-1 lg:col-span-2 p-5 box box--stacked">
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-200/80">
            <Lucide icon="LayoutList" className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-slate-800">Menabò</h2>
          </div>
          <PanelMenabo />
        </div>
      </div>
    </>
  );
}

export default withSessionCheck(Main);
