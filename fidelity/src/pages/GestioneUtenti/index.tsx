import { FormCheck, FormInput, FormSelect } from "@/components/Base/Form";
import { Dialog, Menu, Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Pagination from "@/components/Base/Pagination";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
import Tippy from '@tippyjs/react';
// import users from "@/fakers/users";
import Button from "@/components/Base/Button";
import Table from "@/components/Base/Table";
import clsx from "clsx";
// import { useLoaderData } from "react-router-dom";
import PageHeader from "@/components/Base/PageHeader";
import EmptyState from "@/components/EmptyState";
import { useFetchAllGDO, useFetchAllRuoliGDO, useFetchAllUtentiPaginated, useFetchPuntiVenditaFromIdGDO } from "@/query/query";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { saveAs } from "file-saver";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { STATO_UTENTI, TIPO_UTENTI, UTENTE_GENERE } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { CanaliInterazioneAttributes } from "../../../lib/types";
import { GDOResponseDTO, PuntoVenditaResponseDTO, RuoloUtenteGDOResponseDTO, UtenteResponseDTO } from "../../../server/core/dto";
import { useUser } from "../../context/UserContext";
dayjs.extend(duration);
const filterSchema = yup.object().shape({
  canaleInterazione: yup.string().required(),
  tipoUtente: yup.string().required(),
});

// Schema di validazione per la creazione dell'utente
const userCreationSchema = yup.object().shape({
  nome: yup.string()
    .required("Il nome è obbligatorio")
    .min(2, "Il nome deve contenere almeno 2 caratteri")
    .max(50, "Il nome non può superare i 50 caratteri"),
  cognome: yup.string()
    .required("Il cognome è obbligatorio")
    .min(2, "Il cognome deve contenere almeno 2 caratteri")
    .max(50, "Il cognome non può superare i 50 caratteri"),
  email: yup.string()
    .required("L'email è obbligatoria")
    .email("Inserisci un'email valida"),
  password: yup.string()
    .required("La password è obbligatoria")
    .min(8, "La password deve contenere almeno 8 caratteri")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "La password deve contenere almeno una lettera maiuscola, una minuscola, un numero e un carattere speciale"
    ),
  dataDiNascita: yup.string()
    .required("La data di nascita è obbligatoria")
    .test("is-valid-date", "Data di nascita non valida", function (value) {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime()) && date <= new Date();
    }),
  residenza: yup.string()
    .required("La residenza è obbligatoria"),
  tipoUtente: yup.string()
    .required("Il tipo di utente è obbligatorio"),
  statoUtente: yup.string()
    .required("Lo stato dell'utente è obbligatorio"),
  telefono: yup.string()
    .notRequired()
    .matches(/^[0-9]{10}$/, "Il numero di telefono deve contenere 10 cifre"),
  idPuntoVendita: yup.string()
    .when("tipoUtente", {
      is: TIPO_UTENTI.PUNTOVENDITA,
      then: schema => schema.required("Il punto vendita è obbligatorio per gli utenti Punto Vendita"),
      otherwise: schema => schema.notRequired(),
    }),
  gdoScelta: yup.string()
    .when("tipoUtente", {
      is: (val: string) => val !== TIPO_UTENTI.SUPERADMIN && val !== '',
      then: schema => schema.required("La selezione della GDO è obbligatoria"),
      otherwise: schema => schema.notRequired(),
    }),
  ruolo_gdo: yup.string().notRequired(),
  sesso: yup.string().notRequired(),
})

// Schema di validazione per la modifica dell'utente (senza password)
const userEditSchema = yup.object().shape({
  nome: yup.string()
    .required("Il nome è obbligatorio")
    .min(2, "Il nome deve contenere almeno 2 caratteri")
    .max(50, "Il nome non può superare i 50 caratteri"),
  cognome: yup.string()
    .required("Il cognome è obbligatorio")
    .min(2, "Il cognome deve contenere almeno 2 caratteri")
    .max(50, "Il cognome non può superare i 50 caratteri"),
  email: yup.string()
    .required("L'email è obbligatoria")
    .email("Inserisci un'email valida"),
  dataDiNascita: yup.string()
    .required("La data di nascita è obbligatoria")
    .test("is-valid-date", "Data di nascita non valida", function (value) {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime()) && date <= new Date();
    }),
  residenza: yup.string()
    .required("La residenza è obbligatoria"),
  tipoUtente: yup.string()
    .required("Il tipo di utente è obbligatorio"),
  statoUtente: yup.string()
    .required("Lo stato dell'utente è obbligatorio"),
  telefono: yup.string()
    .notRequired()
    .matches(/^[0-9]{10}$/, "Il numero di telefono deve contenere 10 cifre"),
  idPuntoVendita: yup.string()
    .when("tipoUtente", {
      is: TIPO_UTENTI.PUNTOVENDITA,
      then: schema => schema.required("Il punto vendita è obbligatorio per gli utenti Punto Vendita"),
      otherwise: schema => schema.notRequired(),
    }),
  gdoScelta: yup.string()
    .when("tipoUtente", {
      is: (val: string) => val !== TIPO_UTENTI.SUPERADMIN && val !== '',
      then: schema => schema.required("La selezione della GDO è obbligatoria"),
      otherwise: schema => schema.notRequired(),
    }),
  ruolo_gdo: yup.string().notRequired(),
  sesso: yup.string().notRequired(),
})

const GestioneUtenti: React.FC = () => {
  const puntiVendita = useFetchPuntiVenditaFromIdGDO();
  const [allChecked, setAllChecked] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUtente, setSelectedUtente] = useState<any>(null);
  const [dialogUserCreationOpen, setDialogUserCreationOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rateLimitDialogOpen, setRateLimitDialogOpen] = useState(false);
  const [rateLimitDialogLoading, setRateLimitDialogLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any>(null);
  const [filters, setFilters] = useState<{
    tipoUtente?: string;
    stato?: string;
    sesso?: string;
    haRuoloGDO?: boolean;
    haPuntoVendita?: boolean;
    isAttivo?: boolean;
    isAdmin?: boolean;
    searchTerm?: string;
  }>({});
  const { user } = useUser();
  const { data: allRuoliGDO } = useFetchAllRuoliGDO();
  const { data: allGDO } = useFetchAllGDO();
  // Funzione per gestire la chiusura del dialog con loading
  const handleRateLimitDialogClose = async () => {
    setRateLimitDialogLoading(true);
    // Simula un'operazione asincrona
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRateLimitDialogLoading(false);
    setRateLimitDialogOpen(false);
  };

  // Form per la creazione utente
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm({
    resolver: yupResolver(userCreationSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      password: "",
      dataDiNascita: "",
      residenza: "",
      tipoUtente: TIPO_UTENTI.GUEST,
      statoUtente: STATO_UTENTI.ATTIVO,
      telefono: "",
      gdoScelta: "",
      ruolo_gdo: "",
      sesso: ""
    }
  });

  // Form separato per la modifica utente (senza password)
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: errorsEdit },
    reset: resetEdit,
    setValue: setValueEdit,
    watch: watchEdit
  } = useForm({
    resolver: yupResolver(userEditSchema),
    defaultValues: {
      nome: "",
      cognome: "",
      email: "",
      dataDiNascita: "",
      residenza: "",
      tipoUtente: TIPO_UTENTI.GUEST,
      statoUtente: STATO_UTENTI.ATTIVO,
      telefono: "",
      gdoScelta: "",
      ruolo_gdo: "",
      idPuntoVendita: "",
      sesso: ""
    }
  });

  // Funzione per aprire il dialog di modifica
  const handleEditUser = (utente: any) => {
    setSelectedUserForEdit(utente);
    setEditDialogOpen(true);
    // Precompila il form edit con i dati dell'utente
    setValueEdit("nome", utente.nome || "");
    setValueEdit("cognome", utente.cognome || "");
    setValueEdit("email", utente.email || "");
    setValueEdit("dataDiNascita", utente.datadinascita ? dayjs(utente.datadinascita).format('YYYY-MM-DD') : "");
    setValueEdit("residenza", utente.residenza || "");
    setValueEdit("tipoUtente", utente.tipo || "");
    setValueEdit("statoUtente", utente.stato || STATO_UTENTI.ATTIVO);
    setValueEdit("telefono", utente.telefono || "");
    setValueEdit("gdoScelta", utente.id_gdo || "");
    setValueEdit("ruolo_gdo", utente.ruolo_gdo?.id || "");
    setValueEdit("idPuntoVendita", utente.punto_vendita_collegato?.id || "");
    setValueEdit("sesso", utente.sesso || "");
  };

  // Funzione per gestire l'invio del form di modifica
  const onSubmitEditForm = (data: any) => {
    if (!selectedUserForEdit) return;

    const payload: any = {
      id: selectedUserForEdit.id,
      email: data.email,
      nome: data.nome,
      cognome: data.cognome,
      tipo: data.tipoUtente,
      stato: data.statoUtente,
      residenza: data.residenza,
      dataDiNascita: data.dataDiNascita,
      telefono: data.telefono,
      sesso: data.sesso || undefined,
    };

    // Aggiungi campi condizionali solo se necessari
    if (data.tipoUtente === TIPO_UTENTI.PUNTOVENDITA && data.idPuntoVendita) {
      payload.idPuntoVendita = data.idPuntoVendita;
    }

    if (data.tipoUtente !== TIPO_UTENTI.SUPERADMIN && data.gdoScelta) {
      payload.gdoScelta = data.gdoScelta;
    }

    if (data.tipoUtente !== TIPO_UTENTI.SUPERADMIN && data.ruolo_gdo) {
      payload.id_ruolo_utente_gdo = data.ruolo_gdo;
    }

    updateUtenteMutation.mutate(payload);
  };

  const tipoUtente = filters.tipoUtente || "";
  const stato = filters.stato || "";
  const sesso = filters.sesso || "";
  const idPuntoVendita = watch("idPuntoVendita");

  const exportData = async (type: string) => {
    if (!dataUtentiPaginated) {
      console.error("Nessun dato da esportare");
      return;
    }
    const data = dataUtentiPaginated?.data?.utenti?.map((utente: UtenteResponseDTO) => ({
      Nome: utente.nome,
      Cognome: utente.cognome,
      Email: utente.email,
      Stato: utente.stato,
      Registrato: dayjs(utente.createdat).locale("it").format("DD/MM/YYYY"),
      Tipo: utente.tipo,
    })) as any[];

    const timestamps = dayjs().format("YYYY-MM-DD");

    if (type === 'pdf') {
      const [{ pdf }, { DataTablePdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/DataTablePdfDocument'),
      ]);
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      const rows = data.map((row: any) => Object.values(row).map((v) => String(v ?? '')));
      const blob = await pdf(
        <DataTablePdfDocument title="Gestione Utenti" headers={headers} rows={rows} landscape={false} />
      ).toBlob();
      saveAs(blob, `utenti_${timestamps}.pdf`);
      return;
    }

    const result = await ServerCall.postRaw("/export_users", { format: type, data });

    if (!result.ok) {
      throw new Error(`Errore durante l'esportazione: ${result.statusText}`);
    }

    const real_mime_type = result.headers.get("Content-Type");

    // Mappa dei MIME types alle estensioni
    const mimeToExtension: Record<string, string> = {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "application/vnd.ms-excel": "xls",
      "text/csv": "csv",
      "application/csv": "csv",
      "application/pdf": "pdf",
      "application/zip": "zip"
    };

    // Determina l'estensione dal MIME type o fallback al tipo richiesto
    const file_extension = real_mime_type ? mimeToExtension[real_mime_type] || type : type;

    const resultBuffer = await result.arrayBuffer();
    const buffer = new Uint8Array(resultBuffer);
    const blob = new Blob([buffer], { type: real_mime_type || undefined });

    const timestamp = dayjs().format("YYYY-MM-DD");
    saveAs(blob, `utenti_${timestamp}.${file_extension}`);
  };
  const dataUtentiPaginated = useFetchAllUtentiPaginated(currentPage, pageSize, filters);

  // Funzioni per gestire la paginazione
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset alla prima pagina quando si cambia il limite
  };

  const onSubmitFilters = (data: any) => {
    console.log("Filtri applicati:", data);
    setFilters(data);
    setCurrentPage(1); // Reset alla prima pagina quando si applicano i filtri
  };

  const resetFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  // Helper per convertire i dati per Excel
  const s2ab = (s: string) => {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xff;
    return buf;
  };

  const eliminaUtenteMutation = useMutation({
    mutationKey: ["eliminaUtente"],
    mutationFn: async ({ id, tipoUtente }: { id: string; tipoUtente: TIPO_UTENTI }) => {
      await ServerCall.delete(`/deleteUser?id=${id}`);
    },
    onSuccess: () => {
      console.log("Utente eliminato con successo");
      // Se siamo sull'ultima pagina e non ci sono più elementi, vai alla pagina precedente
      const totalPages = dataUtentiPaginated?.data?.total_pages || 1;
      if (currentPage > 1 && currentPage >= totalPages) {
        setCurrentPage(currentPage - 1);
      } else {
        dataUtentiPaginated.refetch();
      }
      setDeleteDialogOpen(false);
    },
    onError: (error) => {
      console.error("Errore durante l'eliminazione dell'utente", error);
      dataUtentiPaginated.refetch();
    }
  });

  const registerUtenteMutation = useMutation({
    mutationKey: ["registerUtente"],
    mutationFn: async (data: {
      email: string;
      nome: string;
      cognome: string;
      password: string;
      tipo: TIPO_UTENTI;
      stato: STATO_UTENTI;
      residenza: string;
      dataDiNascita: string;
      telefono?: string;
      idPuntoVendita?: string;
      gdoScelta?: string;
      ruoloGDO?: string;
      sesso?: string;
    }) => {
      const payload: any = {
        email: data.email,
        nome: data.nome,
        cognome: data.cognome,
        password: data.password,
        tipo: data.tipo,
        stato: data.stato,
        residenza: data.residenza,
        dataDiNascita: data.dataDiNascita,
        telefono: data.telefono,
        sesso: data.sesso || undefined,
      };

      // Aggiungi campi condizionali solo se presenti e necessari
      if (data.tipo === TIPO_UTENTI.PUNTOVENDITA && data.idPuntoVendita) {
        payload.idPuntoVendita = data.idPuntoVendita;
      }
      if (data.tipo !== TIPO_UTENTI.SUPERADMIN && data.gdoScelta) {
        payload.gdoScelta = data.gdoScelta;
      }
      if (data.tipo !== TIPO_UTENTI.SUPERADMIN && data.ruoloGDO) {
        payload.ruoloGDO = data.ruoloGDO;
      }

      await ServerCall.post("/register-user", payload);
    },
    onSuccess: () => {
      console.log("Utente registrato con successo");
      // Vai alla prima pagina per vedere il nuovo utente
      setCurrentPage(1);
      dataUtentiPaginated.refetch();
      setDialogUserCreationOpen(false);
      reset(); // Reset del form dopo la creazione
    },
    onError: (error: any) => {
      if (error.error === "REGISTRATION_RATE_LIMIT_EXCEEDED") {
        setRateLimitDialogOpen(true);
      }
      console.error("Errore durante la registrazione dell'utente", error);
      dataUtentiPaginated.refetch();
    }
  });

  const updateUtenteMutation = useMutation({
    mutationKey: ["updateUtente"],
    mutationFn: async (data: {
      id: string;
      email: string;
      nome: string;
      cognome: string;
      dataDiNascita: string;
      residenza: string;
      tipo: TIPO_UTENTI;
      stato?: string;
      telefono?: string;
      sesso?: string;
      idPuntoVendita?: string;
      gdoScelta?: string;
      id_ruolo_utente_gdo?: string;
    }) => {
      await ServerCall.put("/updateUser", data);
    },
    onSuccess: () => {
      console.log("Utente aggiornato con successo");
      dataUtentiPaginated.refetch();
      setEditDialogOpen(false);
      setSelectedUserForEdit(null);
      resetEdit();
    },
    onError: (error: any) => {
      console.error("Errore durante l'aggiornamento dell'utente", error);
      dataUtentiPaginated.refetch();
    }
  });

  const onSubmitUserForm = (data: any) => {
    const payload: any = {
      email: data.email,
      nome: data.nome,
      cognome: data.cognome,
      password: data.password,
      tipo: data.tipoUtente,
      stato: data.statoUtente,
      residenza: data.residenza,
      dataDiNascita: data.dataDiNascita,
      telefono: data.telefono,
      sesso: data.sesso || undefined,
    };

    // Aggiungi campi condizionali solo se necessari
    if (data.tipoUtente === TIPO_UTENTI.PUNTOVENDITA && data.idPuntoVendita) {
      payload.idPuntoVendita = data.idPuntoVendita;
    }

    if (data.tipoUtente !== TIPO_UTENTI.SUPERADMIN && data.gdoScelta) {
      payload.gdoScelta = data.gdoScelta;
    }

    if (data.tipoUtente !== TIPO_UTENTI.SUPERADMIN && data.ruolo_gdo) {
      payload.ruoloGDO = data.ruolo_gdo;
    }

    registerUtenteMutation.mutate(payload);
  };

  // Resetta il form quando si apre la finestra di dialogo
  useEffect(() => {
    if (dialogUserCreationOpen) {
      reset();
    }
  }, [dialogUserCreationOpen, reset]);

  // Resetta il form edit quando si apre il dialog di modifica
  useEffect(() => {
    if (editDialogOpen && selectedUserForEdit) {
      // Precompila il form edit con i dati dell'utente selezionato
      setValueEdit("nome", selectedUserForEdit.nome || "");
      setValueEdit("cognome", selectedUserForEdit.cognome || "");
      setValueEdit("email", selectedUserForEdit.email || "");
      setValueEdit("dataDiNascita", selectedUserForEdit.datadinascita ? dayjs(selectedUserForEdit.datadinascita).format('YYYY-MM-DD') : "");
      setValueEdit("residenza", selectedUserForEdit.residenza || "");
      setValueEdit("tipoUtente", selectedUserForEdit.tipo || "");
      setValueEdit("statoUtente", selectedUserForEdit.stato || STATO_UTENTI.ATTIVO);
      setValueEdit("telefono", selectedUserForEdit.telefono || "");
      setValueEdit("gdoScelta", selectedUserForEdit.id_gdo || "");
      setValueEdit("ruolo_gdo", selectedUserForEdit.ruolo_gdo?.id || "");
      setValueEdit("idPuntoVendita", selectedUserForEdit.punto_vendita_collegato?.id || "");
      setValueEdit("sesso", selectedUserForEdit.sesso || "");
    }
  }, [editDialogOpen, selectedUserForEdit, setValueEdit]);

  return (
    <>
      <Dialog open={rateLimitDialogOpen} onClose={() => {
        if (!rateLimitDialogLoading) {
          setRateLimitDialogOpen(false);
        }
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Lucide icon="Timer" className="w-6 h-6 text-warning" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">
                Limite di richieste superato
              </h2>
            </div>
          </Dialog.Title>
          <Dialog.Description className="mt-4">
            <div className="flex items-start gap-3">
              <Lucide icon="Clock" className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-600">
                <p className="mb-2">
                  Hai superato il limite di richieste al server. Per favore attendi prima di riprovare.
                </p>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Lucide icon="Timer" className="w-4 h-4" />
                    <span className="font-medium">Riprova tra:</span>
                    <span className="font-mono text-warning font-semibold">
                      {dayjs.duration(36000).format("HH:mm:ss")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Dialog.Description>
          <Dialog.Footer className="mt-6 flex gap-3 justify-end">
            <Button
              variant="outline-secondary"
              onClick={() => {
                setRateLimitDialogOpen(false);
              }}
              disabled={rateLimitDialogLoading}
              className="px-4"
            >
              <Lucide icon="X" className="w-4 h-4 mr-2" />
              Chiudi
            </Button>
            <Button
              variant="primary"
              onClick={handleRateLimitDialogClose}
              disabled={rateLimitDialogLoading}
              className="px-4"
            >
              {rateLimitDialogLoading ? (
                <>
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  Elaborazione...
                </>
              ) : (
                <>
                  <Lucide icon="Check" className="w-4 h-4 mr-2" />
                  Ho capito
                </>
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <Dialog open={deleteDialogOpen} onClose={() => {
        if (!eliminaUtenteMutation.isPending) {
          setDeleteDialogOpen(false);
        }
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Lucide icon="UserMinus" className="w-6 h-6 text-danger" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">
                Elimina utente
              </h2>
            </div>
          </Dialog.Title>
          <Dialog.Description className="mt-4">
            <div className="flex items-start gap-3">
              <Lucide icon="UserX" className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-slate-600">
                <p className="mb-3">
                  Sei sicuro di voler eliminare questo utente? Questa azione non può essere annullata.
                </p>
                {selectedUtente && (
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Lucide icon="User" className="w-4 h-4" />
                      <span className="font-medium">Utente:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedUtente.nome} {selectedUtente.cognome}
                      </span>
                    </div>
                    {selectedUtente.email && (
                      <div className="flex items-center gap-2 text-slate-600 mt-1">
                        <Lucide icon="Mail" className="w-4 h-4" />
                        <span className="text-sm">{selectedUtente.email}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Dialog.Description>
          <Dialog.Footer className="mt-6 flex gap-3 justify-end">
            <Button
              variant="outline-secondary"
              onClick={() => {
                setDeleteDialogOpen(false);
              }}
              disabled={eliminaUtenteMutation.isPending}
              className="px-4"
            >
              <Lucide icon="X" className="w-4 h-4 mr-2" />
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                eliminaUtenteMutation.mutate({ id: selectedUtente.id, tipoUtente: selectedUtente.tipo });
              }}
              disabled={eliminaUtenteMutation.isPending}
              className="px-4"
            >
              {eliminaUtenteMutation.isPending ? (
                <>
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                <>
                  <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                  Elimina
                </>
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Dialog di modifica utente */}
      <Dialog size="xl" open={editDialogOpen} onClose={() => {
        if (!updateUtenteMutation.isPending) {
          setEditDialogOpen(false);
          setSelectedUserForEdit(null);
        }
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <Lucide icon="User" className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-slate-800">
                Modifica utente
              </h2>
            </div>
          </Dialog.Title>
          <Dialog.Description>
            <form onSubmit={handleSubmitEdit(onSubmitEditForm)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <FormInput
                    {...registerEdit("nome")}
                    type="text"
                    placeholder="Inserisci il nome"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.nome ? 'border-red-500' : ''}`}
                  />
                  {errorsEdit.nome && <p className="text-red-500 text-xs mt-1">{errorsEdit.nome.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cognome</label>
                  <FormInput
                    {...registerEdit("cognome")}
                    type="text"
                    placeholder="Inserisci il cognome"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.cognome ? 'border-red-500' : ''}`}
                  />
                  {errorsEdit.cognome && <p className="text-red-500 text-xs mt-1">{errorsEdit.cognome.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <FormInput
                    {...registerEdit("email")}
                    type="email"
                    autoComplete="email webauthn"
                    placeholder="Inserisci l'email"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.email ? 'border-red-500' : ''}`}
                  />
                  {errorsEdit.email && <p className="text-red-500 text-xs mt-1">{errorsEdit.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefono</label>
                  <FormInput
                    {...registerEdit("telefono")}
                    type="tel"
                    placeholder="Inserisci il telefono"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.telefono ? 'border-red-500' : ''}`}
                  />
                  {errorsEdit.telefono && <p className="text-red-500 text-xs mt-1">{errorsEdit.telefono.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data di Nascita</label>
                  <FormInput
                    {...registerEdit("dataDiNascita")}
                    type="date"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.dataDiNascita ? 'border-red-500' : ''}`}
                  />
                  {errorsEdit.dataDiNascita && <p className="text-red-500 text-xs mt-1">Data di nascita non valida</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Residenza</label>
                  <FormInput
                    {...registerEdit("residenza")}
                    type="text"
                    placeholder="Inserisci la residenza"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.residenza ? 'border-red-500' : ''}`}
                  />
                  {errorsEdit.residenza && <p className="text-red-500 text-xs mt-1">{errorsEdit.residenza.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sesso</label>
                  <FormSelect
                    {...registerEdit("sesso")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="">Non specificato</option>
                    {Object.entries(UTENTE_GENERE).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </FormSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stato Utente</label>
                  <FormSelect
                    {...registerEdit("statoUtente")}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.statoUtente ? 'border-red-500' : ''}`}
                  >
                    {Object.keys(STATO_UTENTI).map((key) => (
                      <option key={key} value={STATO_UTENTI[key as keyof typeof STATO_UTENTI]}>
                        {STATO_UTENTI[key as keyof typeof STATO_UTENTI]}
                      </option>
                    ))}
                  </FormSelect>
                  {errorsEdit.statoUtente && <p className="text-red-500 text-xs mt-1">{errorsEdit.statoUtente.message}</p>}
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Tipo Utente</label>
                  <FormSelect
                    {...registerEdit("tipoUtente")}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.tipoUtente ? 'border-red-500' : ''}`}
                  >
                    {(() => {
                      let allowedTypes: string[] = [];
                      if (user?.tipo === TIPO_UTENTI.GDO) {
                        allowedTypes = Object.values(TIPO_UTENTI).filter(
                          (v) => v !== TIPO_UTENTI.GDO && v !== TIPO_UTENTI.SUPERADMIN
                        );
                      } else if (user?.tipo === TIPO_UTENTI.PUNTOVENDITA) {
                        allowedTypes = Object.values(TIPO_UTENTI).filter(
                          (v) => v !== TIPO_UTENTI.GDO && v !== TIPO_UTENTI.SUPERADMIN && v !== TIPO_UTENTI.GUEST
                        );
                      } else {
                        allowedTypes = Object.values(TIPO_UTENTI);
                      }
                      return allowedTypes.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ));
                    })()}
                  </FormSelect>
                  {errorsEdit.tipoUtente && <p className="text-red-500 text-xs mt-1">{errorsEdit.tipoUtente.message}</p>}
                </div>

                {/* Campo GDO - mostrato per tutti tranne SUPERADMIN */}
                {watchEdit("tipoUtente") && watchEdit("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">GDO da associare</label>
                    <FormSelect
                      {...registerEdit("gdoScelta")}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.gdoScelta ? 'border-red-500' : ''}`}
                    >
                      <option value="">Seleziona una GDO</option>
                      {allGDO?.map((gdo: GDOResponseDTO) => (
                        <option key={gdo.id} value={gdo.id}>
                          {gdo.nome} {gdo.ragione_sociale ? `(${gdo.ragione_sociale})` : ''}
                        </option>
                      ))}
                    </FormSelect>
                    {errorsEdit.gdoScelta && <p className="text-red-500 text-xs mt-1">{errorsEdit.gdoScelta.message}</p>}
                  </div>
                )}

                {/* Campo Ruolo - mostrato per tutti tranne SUPERADMIN */}
                {watchEdit("tipoUtente") && watchEdit("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Ruolo (opzionale)</label>
                    <FormSelect
                      {...registerEdit("ruolo_gdo")}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.ruolo_gdo ? 'border-red-500' : ''}`}
                    >
                      {allRuoliGDO?.map((ruolo: RuoloUtenteGDOResponseDTO) => (
                        <option key={ruolo.id} value={ruolo.id}>
                          {ruolo.ruolo.replace("_", " ")}
                        </option>
                      ))}
                    </FormSelect>
                    {errorsEdit.ruolo_gdo && <p className="text-red-500 text-xs mt-1">{errorsEdit.ruolo_gdo.message}</p>}
                  </div>
                )}

                {/* Campo Punto Vendita - mostrato solo se il tipo utente è PUNTOVENDITA */}
                {watchEdit("tipoUtente") === TIPO_UTENTI.PUNTOVENDITA && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Punto Vendita da collegare</label>
                    <FormSelect
                      {...registerEdit("idPuntoVendita")}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errorsEdit.idPuntoVendita ? 'border-red-500' : ''}`}
                    >
                      <option value="">Seleziona un punto vendita</option>
                      {puntiVendita?.data?.map((punto: PuntoVenditaResponseDTO) => (
                        <option key={punto.id} value={punto.id}>
                          {punto.nome}
                        </option>
                      ))}
                    </FormSelect>
                    {errorsEdit.idPuntoVendita && <p className="text-red-500 text-xs mt-1">{errorsEdit.idPuntoVendita.message}</p>}
                  </div>
                )}
              </div>
            </form>
          </Dialog.Description>
          <Dialog.Footer className="mt-6 flex gap-3 justify-end">
            <Button
              variant="outline-secondary"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedUserForEdit(null);
                resetEdit();
              }}
              disabled={updateUtenteMutation.isPending}
              className="px-4"
            >
              <Lucide icon="X" className="w-4 h-4 mr-2" />
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitEdit(onSubmitEditForm)}
              disabled={updateUtenteMutation.isPending}
              className="px-4"
            >
              {updateUtenteMutation.isPending ? (
                <>
                  <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                  Aggiornamento...
                </>
              ) : (
                <>
                  <Lucide icon="Save" className="w-4 h-4 mr-2" />
                  Salva modifiche
                </>
              )}
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <Dialog size="xl" open={dialogUserCreationOpen} onClose={() => {
        setDialogUserCreationOpen(false);
      }}>
        <Dialog.Panel className="">
          <Dialog.Title>
            <h2 className="mr-auto text-base font-medium">
              Crea nuovo utente
            </h2></Dialog.Title>
          <Dialog.Description>
            <form onSubmit={handleSubmit(onSubmitUserForm)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nome</label>
                  <FormInput
                    {...register("nome")}
                    type="text"
                    placeholder="Inserisci il nome"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.nome ? 'border-red-500' : ''}`}
                  />
                  {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cognome</label>
                  <FormInput
                    {...register("cognome")}
                    type="text"
                    placeholder="Inserisci il cognome"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.cognome ? 'border-red-500' : ''}`}
                  />
                  {errors.cognome && <p className="text-red-500 text-xs mt-1">{errors.cognome.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <FormInput
                    {...register("email")}
                    type="email"
                    autoComplete="email webauthn"
                    placeholder="Inserisci l'email"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.email ? 'border-red-500' : ''}`}
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <FormInput
                    {...register("password")}
                    type="password"
                    placeholder="Inserisci la password"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.password ? 'border-red-500' : ''}`}
                  />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data di Nascita</label>
                  <FormInput
                    {...register("dataDiNascita")}
                    type="date"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.dataDiNascita ? 'border-red-500' : ''}`}
                  />
                  {errors.dataDiNascita && <p className="text-red-500 text-xs mt-1">Data di nascita non valida</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Residenza</label>
                  <FormInput
                    {...register("residenza")}
                    type="text"
                    placeholder="Inserisci la residenza"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.residenza ? 'border-red-500' : ''}`}
                  />
                  {errors.residenza && <p className="text-red-500 text-xs mt-1">{errors.residenza.message}</p>}
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Tipo Utente</label>
                  <FormSelect
                    {...register("tipoUtente")}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.tipoUtente ? 'border-red-500' : ''}`}
                  >
                    {(() => {
                      // Precalcola le opzioni disponibili in base al tipo utente loggato
                      let allowedTypes: string[] = [];
                      if (user?.tipo === TIPO_UTENTI.GDO) {
                        // Un utente GDO non può creare altri GDO o Superadmin
                        allowedTypes = Object.values(TIPO_UTENTI).filter(
                          (v) => v !== TIPO_UTENTI.GDO && v !== TIPO_UTENTI.SUPERADMIN
                        );
                      } else if (user?.tipo === TIPO_UTENTI.PUNTOVENDITA) {
                        // Un PuntoVendita non può creare GDO, Superadmin o Guest
                        allowedTypes = Object.values(TIPO_UTENTI).filter(
                          (v) => v !== TIPO_UTENTI.GDO && v !== TIPO_UTENTI.SUPERADMIN && v !== TIPO_UTENTI.GUEST
                        );
                      } else {
                        allowedTypes = Object.values(TIPO_UTENTI);
                      }
                      return allowedTypes.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ));
                    })()}
                  </FormSelect>
                  {errors.tipoUtente && <p className="text-red-500 text-xs mt-1">{errors.tipoUtente.message}</p>}
                </div>

                {/* Campo Ruolo - mostrato per tutti tranne SUPERADMIN */}

                {watch("tipoUtente") === TIPO_UTENTI.PUNTOVENDITA && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Punto Vendita da collegare</label>
                    <FormSelect
                      {...register("idPuntoVendita")}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.idPuntoVendita ? 'border-red-500' : ''}`}
                    >
                      <option value="">Seleziona un punto vendita</option>
                      {puntiVendita?.data?.map((punto: PuntoVenditaResponseDTO) => (
                        <option key={punto.id} value={punto.id}>
                          {punto.nome}
                        </option>
                      ))}
                    </FormSelect>
                    {errors.idPuntoVendita && <p className="text-red-500 text-xs mt-1">{errors.idPuntoVendita.message}</p>}
                  </div>
                )}
                {watch("tipoUtente") && watch("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">GDO da associare</label>
                    <FormSelect
                      {...register("gdoScelta")}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.gdoScelta ? 'border-red-500' : ''}`}
                    >
                      <option value="">Seleziona una GDO</option>
                      {allGDO?.map((gdo: GDOResponseDTO) => (
                        <option key={gdo.id} value={gdo.id}>
                          {gdo.nome} {gdo.ragione_sociale ? `(${gdo.ragione_sociale})` : ''}
                        </option>
                      ))}
                    </FormSelect>
                    {errors.gdoScelta && <p className="text-red-500 text-xs mt-1">{errors.gdoScelta.message}</p>}
                  </div>
                )}
                {watch("tipoUtente") && watch("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Ruolo (opzionale)</label>
                    <FormSelect
                      {...register("ruolo_gdo")}
                      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.ruolo_gdo ? 'border-red-500' : ''}`}
                    >
                      <option value="">Seleziona un ruolo (opzionale)</option>
                      {allRuoliGDO?.map((ruolo: RuoloUtenteGDOResponseDTO) => (
                        <option key={ruolo.id} value={ruolo.id}>
                          {ruolo.ruolo.replace("_", " ")}
                        </option>
                      ))}
                    </FormSelect>
                    {errors.ruolo_gdo && <p className="text-red-500 text-xs mt-1">{errors.ruolo_gdo.message}</p>}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sesso</label>
                  <FormSelect
                    {...register("sesso")}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                  >
                    <option value="">Non specificato</option>
                    {Object.entries(UTENTE_GENERE).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </FormSelect>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stato Utente</label>
                  <FormSelect
                    {...register("statoUtente")}
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.statoUtente ? 'border-red-500' : ''}`}
                  >
                    {Object.keys(STATO_UTENTI).map((key) => (
                      <option key={key} value={STATO_UTENTI[key as keyof typeof STATO_UTENTI]}>
                        {STATO_UTENTI[key as keyof typeof STATO_UTENTI]}
                      </option>
                    ))}
                  </FormSelect>
                  {errors.statoUtente && <p className="text-red-500 text-xs mt-1">{errors.statoUtente.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Telefono</label>
                  <FormInput
                    {...register("telefono")}
                    type="text"
                    placeholder="Inserisci il numero di telefono"
                    className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm ${errors.telefono ? 'border-red-500' : ''}`}
                  />
                  {errors.telefono && <p className="text-red-500 text-xs mt-1">{errors.telefono.message}</p>}
                </div>
              </div>
              <Dialog.Footer className="flex flex-col sm:flex-row gap-2 justify-end mt-6">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDialogUserCreationOpen(false);
                  }}
                  type="button"
                  className="w-full sm:w-auto"
                >
                  Annulla
                </Button>
                <Button variant="primary" type="submit" className="w-full sm:w-auto">Crea</Button>
              </Dialog.Footer>
            </form>
          </Dialog.Description>
        </Dialog.Panel>
      </Dialog>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <div className="flex flex-col gap-y-3 lg:h-10 lg:items-center lg:flex-row">
            <PageHeader
              title="Gestione Utenti"
              description="Gestisci e amministra tutti gli utenti del sistema con controllo completo su ruoli, permessi e stati account"
            />
            <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 lg:ml-auto">
              <PermissionGate permission={PERMISSIONS.UTENTI.CREA} mode="disable">
                <Button
                  variant="primary"
                  className="group-[.mode--light]:!bg-white/[0.12] group-[.mode--light]:!text-slate-200 group-[.mode--light]:!border-transparent w-full sm:w-auto"
                  onClick={() => {
                    setDialogUserCreationOpen(true);
                  }}
                >
                  <Lucide icon="PenLine" className="stroke-[1.3] w-4 h-4 mr-2" />{" "}
                  <span className="hidden sm:inline">Aggiungi un nuovo utente</span>
                  <span className="sm:hidden">Nuovo utente</span>
                </Button>
              </PermissionGate>
            </div>
          </div>
          <div className="flex flex-col gap-8 mt-3.5">
            <div className="flex flex-col box box--stacked">
              <div className="flex flex-col p-3 sm:p-5 sm:items-center sm:flex-row gap-y-3">
                <div className="">
                  <div className="relative">
                    <Lucide
                      icon="Search"
                      className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                    />
                    <FormInput
                      type="text"
                      placeholder="Cerca utenti"
                      className="pl-9 w-full sm:w-64 rounded-[0.5rem]"
                      value={filters.searchTerm}
                      onChange={(e) => {
                        onSubmitFilters({ ...filters, searchTerm: e.target.value });
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto w-full sm:w-auto">
                  <PermissionGate permission={PERMISSIONS.UTENTI.ESPORTA} mode="disable">
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
                        <span className="hidden sm:inline">Esporta come</span>
                        <span className="sm:hidden">Esporta</span>
                        <Lucide
                          icon="ChevronDown"
                          className="stroke-[1.3] w-4 h-4 ml-2"
                        />
                      </Menu.Button>
                      <Menu.Items className="w-40">
                        <Menu.Item onClick={() => exportData('pdf')}>
                          <Lucide icon="FileText" className="w-4 h-4 mr-2" />{" "}
                          PDF
                        </Menu.Item>
                        <Menu.Item onClick={() => exportData('csv')}>
                          <Lucide icon="FileSpreadsheet" className="w-4 h-4 mr-2" />
                          CSV
                        </Menu.Item>
                        <Menu.Item onClick={() => exportData('xlsx')}>
                          <Lucide icon="FileSpreadsheet" className="w-4 h-4 mr-2" />
                          Excel
                        </Menu.Item>
                        <Menu.Item onClick={() => exportData('xls')}>
                          <Lucide icon="FileSpreadsheet" className="w-4 h-4 mr-2" />
                          Excel (legacy)
                        </Menu.Item>
                        <Menu.Item onClick={() => exportData('json')}>
                          <Lucide icon="FileJson2" className="w-4 h-4 mr-2" />
                          JSON
                        </Menu.Item>
                      </Menu.Items>
                    </Menu>
                  </PermissionGate>
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
                          <span className="hidden sm:inline">Filtri</span>
                          <span className="sm:hidden">Filtri</span>
                          {Object.values({ tipoUtente, stato, sesso }).filter(value => value !== "").length > 0 && (
                            <span className="ml-1.5 px-2 py-[1px] rounded-full bg-primary/10 text-primary text-xs font-medium">
                              {Object.values({ tipoUtente, stato, sesso }).filter(value => value !== "").length}
                            </span>
                          )}
                        </Popover.Button>
                        <Popover.Panel placement="bottom-end">
                          <div className="p-2">
                            <div>
                              <div className="text-left text-slate-500">
                                Stato
                              </div>
                              <FormSelect
                                value={stato}
                                onChange={(e) => {
                                  onSubmitFilters({ ...filters, stato: e.target.value });
                                }}
                                className="flex-1 mt-2">
                                <option value="">Tutti</option>
                                <option value="ATTIVO">Attivo</option>
                                <option value="INATTIVO">Inattivo</option>
                              </FormSelect>
                            </div>
                            <div className="mt-3">
                              <div className="text-left text-slate-500">
                                Tipo di utenti
                              </div>
                              <FormSelect
                                value={tipoUtente}
                                onChange={(e) => {
                                  onSubmitFilters({ ...filters, tipoUtente: e.target.value });
                                }}
                                className="flex-1 mt-2">
                                <option value="">Tutti</option>
                                {Object.keys(TIPO_UTENTI).map((key) => {
                                  const tipoKey = key as keyof typeof TIPO_UTENTI;
                                  return <option key={tipoKey} value={TIPO_UTENTI[tipoKey]}>{TIPO_UTENTI[tipoKey]}</option>
                                })}
                              </FormSelect>
                            </div>
                            <div className="mt-3">
                              <div className="text-left text-slate-500">
                                Sesso
                              </div>
                              <FormSelect
                                value={sesso}
                                onChange={(e) => {
                                  onSubmitFilters({ ...filters, sesso: e.target.value });
                                }}
                                className="flex-1 mt-2">
                                <option value="">Tutti</option>
                                <option value="M">Maschio</option>
                                <option value="F">Femmina</option>
                                <option value="N">Non specificato</option>
                              </FormSelect>
                            </div>
                            <div className="flex items-center mt-4">
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  close();
                                }}
                                className="w-24 ml-auto"
                              >
                                Chiudi
                              </Button>
                              <Button
                                variant="outline-secondary"
                                onClick={() => {
                                  resetFilters();
                                  close();
                                }}
                                className="w-24 ml-2"
                              >
                                Reset
                              </Button>
                              <Button
                                onClick={() => {
                                  onSubmitFilters(filters);
                                  close();
                                }}
                                variant="primary"
                                className="w-24 ml-2">
                                Applica
                              </Button>
                            </div>
                          </div>
                        </Popover.Panel>
                      </>
                    )}
                  </Popover>
                </div>
              </div>
              {/* Vista Desktop - Tabella */}
              <div className="hidden lg:block overflow-auto xl:overflow-visible">
                <Table className="border-b border-slate-200/60">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Td className="w-5 py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        <FormCheck.Input type="checkbox" onChange={(e) => {
                          setAllChecked(e.target.checked);
                        }} />
                      </Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Nome & Cognome
                      </Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Canale di arrivo
                      </Table.Td>
                      <Table.Td className="py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Stato
                      </Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Data di registrazione
                      </Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Tipo Utente
                      </Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Ruolo GDO
                      </Table.Td>
                      <Table.Td className="py-4 font-medium border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Punto Vendita
                      </Table.Td>
                      <Table.Td className="w-20 py-4 font-medium text-center border-t bg-slate-50 border-slate-200/60 text-slate-500">
                        Azioni
                      </Table.Td>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dataUtentiPaginated?.isLoading && (
                      <Table.Tr>
                        <Table.Td colSpan={8} className="py-8 text-center text-slate-500">
                          <div className="flex items-center justify-center">
                            <Lucide icon="Loader" className="w-6 h-6 animate-spin mr-2" />
                            Caricamento utenti...
                          </div>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={8} className="py-4 text-center text-slate-500">
                          <EmptyState
                            icon="UserX"
                            title="Nessun utente trovato"
                            description="Non ci sono utenti da mostrare."
                          />
                        </Table.Td>
                      </Table.Tr>
                    )}
                    {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.map((utente: UtenteResponseDTO & {
                      canali_interazione: Array<CanaliInterazioneAttributes>;
                      ruolo_gdo?: { id: string; ruolo: string } | null;
                      punto_vendita_collegato?: { id: string; nome: string } | null;
                    }, key: any) => (
                      <Table.Tr key={key} className="[&_td]:last:border-b-0">
                        <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                          <FormCheck.Input type="checkbox" checked={allChecked} onChange={() => { }} />
                        </Table.Td>
                        <Table.Td className="py-4 border-dashed w-80 dark:bg-darkmode-600">
                          <div className="flex items-center">
                            <div className="w-9 h-9 image-fit zoom-in">
                              <Tippy
                                className="rounded-full shadow-[0px_0px_0px_2px_#fff,_1px_1px_5px_rgba(0,0,0,0.32)] dark:shadow-[0px_0px_0px_2px_#3f4865,_1px_1px_5px_rgba(0,0,0,0.32)]"
                                content={`${utente.nome_completo}`}
                              />
                            </div>
                            <div className="ml-3.5">
                              <a
                                href=""
                                className="font-medium whitespace-nowrap"
                              >
                                {utente.nome_completo}
                              </a>
                              <div className="text-slate-500 text-xs whitespace-nowrap mt-0.5">
                                {utente.email}
                              </div>
                            </div>
                          </div>
                        </Table.Td>
                        <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                          <p className="font-medium whitespace-nowrap">
                            <span className="flex items-center gap-2">
                              <Lucide
                                icon={(() => {
                                  switch (utente?.canali_interazione?.[0]?.tipo_canaliinterazione) {
                                    case "WHATSAPP":
                                      return "MessageCircle";
                                    case "EMAIL":
                                      return "Mail";
                                    case "TELEGRAM":
                                      return "Send";
                                    case "FACEBOOK":
                                      return "MessageCircle";
                                    case "INSTAGRAM":
                                      return "Camera";
                                    case "LINKEDIN":
                                      return "Briefcase";
                                    case "GOOGLE":
                                      return "Globe";
                                    case "SMS":
                                      return "Smartphone";
                                    default:
                                      return "User";
                                  }
                                })()}
                                className={clsx("w-4 h-4", {
                                  "text-green-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "WHATSAPP",
                                  "text-blue-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "EMAIL",
                                  "text-blue-400": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "TELEGRAM",
                                  "text-blue-600": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "FACEBOOK",
                                  "text-pink-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "INSTAGRAM",
                                  "text-blue-700": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "LINKEDIN",
                                  "text-red-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "GOOGLE",
                                  "text-yellow-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "SMS",
                                  "text-gray-500": !utente?.canali_interazione?.[0]?.tipo_canaliinterazione
                                })}
                              />
                              {(() => {
                                switch (utente?.canali_interazione?.[0]?.tipo_canaliinterazione) {
                                  case "WHATSAPP":
                                    return "WhatsApp";
                                  case "EMAIL":
                                    return "Email";
                                  case "TELEGRAM":
                                    return "Telegram";
                                  case "FACEBOOK":
                                    return "Facebook";
                                  case "INSTAGRAM":
                                    return "Instagram";
                                  case "LINKEDIN":
                                    return "LinkedIn";
                                  case "GOOGLE":
                                    return "Google";
                                  case "SMS":
                                    return "SMS";
                                  default:
                                    return "Interno";
                                }
                              })()}
                            </span>
                          </p>
                        </Table.Td>
                        <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                          <div
                            className={clsx([
                              "flex items-center justify-center",
                              {
                                "text-success": utente.stato === "ATTIVO",
                                "text-danger": utente.stato === "DISATTIVO",
                              },
                            ])}
                          >
                            <Lucide
                              icon={(() => {
                                switch (utente.stato) {
                                  case STATO_UTENTI.ATTIVO:
                                    return "CircleCheck";
                                  case STATO_UTENTI.DISATTIVO:
                                    return "CircleX";
                                  case STATO_UTENTI.SOSPESO:
                                    return "CirclePause";
                                  case STATO_UTENTI.ELIMINATO:
                                    return "Trash";
                                  default:
                                    return "CircleX"; // Default to a valid icon
                                }
                              })()}
                              className="w-3.5 h-3.5 stroke-[1.7]"
                            />
                            <div className="ml-1.5 whitespace-nowrap">
                              {(() => {
                                switch (utente.stato) {
                                  case STATO_UTENTI.ATTIVO:
                                    return "Attivo";
                                  case STATO_UTENTI.DISATTIVO:
                                    return "Disattivo";
                                  case STATO_UTENTI.SOSPESO:
                                    return "Sospeso";
                                  case STATO_UTENTI.ELIMINATO:
                                    return "Eliminato";
                                  default:
                                    return "Unknown";
                                }
                              })()}
                            </div>
                          </div>
                        </Table.Td>
                        <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                          <div className="whitespace-nowrap">
                            {dayjs(utente.createdat).locale("it").format("DD MMMM, YYYY HH:mm")}
                          </div>
                        </Table.Td>
                        <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                          <div className="whitespace-nowrap">
                            {(() => {
                              switch (utente.tipo) {
                                case TIPO_UTENTI.SUPERADMIN:
                                  return "Superadmin";
                                case TIPO_UTENTI.AGENZIA:
                                  return "Agenzia";
                                case TIPO_UTENTI.PUNTOVENDITA:
                                  if (utente.punto_vendita_collegato) return "Punto Vendita"
                                  return "Punto Vendita";
                                case TIPO_UTENTI.GUEST:
                                  return "Guest";
                                case TIPO_UTENTI.GDO:
                                  return "GDO";
                                case TIPO_UTENTI.CATEGORY:
                                  return "Category";
                                case TIPO_UTENTI.MARKETING:
                                  return "Marketing";
                                case TIPO_UTENTI.IT:
                                  return "IT";
                                default:
                                  return "Unknown";
                              }
                            })()}
                          </div>
                        </Table.Td>
                        <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                          <div className="whitespace-nowrap">
                            {utente.ruolo_gdo ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {utente.ruolo_gdo.ruolo.replace("_", " ")}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td className="py-4 border-dashed dark:bg-darkmode-600">
                          <div className="whitespace-nowrap text-center">
                            {utente.punto_vendita_collegato ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {utente.punto_vendita_collegato.nome}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td className="relative py-4 border-dashed dark:bg-darkmode-600">
                          <div className="flex items-center justify-center">
                            <Popover className="h-5">
                              <Popover.Button className=" flex items-center justify-center w-5 h-5 text-slate-500 hover:bg-slate-100 rounded-full transition duration-300">
                                <Lucide
                                  icon="EllipsisVertical"
                                  className="w-5 h-5"
                                />
                              </Popover.Button>
                              <Popover.Panel className="absolute right-0 z-10 mt-2 w-40 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      handleEditUser(utente);
                                    }}
                                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 transition duration-150"
                                  >
                                    <Lucide
                                      icon="User"
                                      className="w-4 h-4 mr-2"
                                    />
                                    Modifica
                                  </button>
                                  <PermissionGate permission={PERMISSIONS.UTENTI.ELIMINA}>
                                    <button
                                      onClick={() => {
                                        setDeleteDialogOpen(true);
                                        setSelectedUtente(utente);
                                      }}
                                      className="flex items-center w-full px-4 py-2 text-sm text-danger hover:bg-slate-100 transition duration-150"
                                    >
                                      <Lucide
                                        icon="Trash2"
                                        className="w-4 h-4 mr-2"
                                      />
                                      Elimina
                                    </button>
                                  </PermissionGate>
                                </div>
                              </Popover.Panel>
                            </Popover>
                          </div>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>

              {/* Vista Mobile - Card */}
              <div className="lg:hidden space-y-4 p-4">
                {dataUtentiPaginated?.isLoading && (
                  <div className="flex items-center justify-center py-8 text-slate-500">
                    <Lucide icon="Loader" className="w-6 h-6 animate-spin mr-2" />
                    Caricamento utenti...
                  </div>
                )}

                {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.length === 0 && (
                  <div className="py-8 text-center text-slate-500">
                    <EmptyState
                      icon="UserX"
                      title="Nessun utente trovato"
                      description="Non ci sono utenti da mostrare."
                    />
                  </div>
                )}

                {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.map((utente: UtenteResponseDTO & {
                  canali_interazione: Array<CanaliInterazioneAttributes>;
                  ruolo_gdo?: { id: string; ruolo: string } | null;
                  punto_vendita_collegato?: { id: string; nome: string } | null;
                }, key: any) => (
                  <div key={key} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                          <Lucide icon="User" className="w-5 h-5 text-slate-500" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">{utente.nome_completo}</h3>
                          <p className="text-sm text-slate-500">{utente.email}</p>
                        </div>
                      </div>
                      <Menu className="h-5">
                        <Menu.Button className="flex items-center justify-center w-8 h-8 text-slate-500 hover:bg-slate-100 rounded-full transition duration-300">
                          <Lucide icon="EllipsisVertical" className="w-5 h-5" />
                        </Menu.Button>
                        <Menu.Items className="w-40">
                          <Menu.Item onClick={() => {
                            handleEditUser(utente);
                          }}>
                            <Lucide icon="User" className="w-4 h-4 mr-2" />
                            Modifica
                          </Menu.Item>
                          <PermissionGate permission={PERMISSIONS.UTENTI.ELIMINA}>
                            <Menu.Item onClick={() => {
                              setDeleteDialogOpen(true);
                              setSelectedUtente(utente);
                            }} className="text-danger">
                              <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                              Elimina
                            </Menu.Item>
                          </PermissionGate>
                        </Menu.Items>
                      </Menu>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500">Stato:</span>
                        <div className={clsx([
                          "flex items-center mt-1",
                          {
                            "text-success": utente.stato === "ATTIVO",
                            "text-danger": utente.stato === "DISATTIVO",
                          },
                        ])}>
                          <Lucide
                            icon={(() => {
                              switch (utente.stato) {
                                case STATO_UTENTI.ATTIVO:
                                  return "CircleCheck";
                                case STATO_UTENTI.DISATTIVO:
                                  return "CircleX";
                                case STATO_UTENTI.SOSPESO:
                                  return "CirclePause";
                                case STATO_UTENTI.ELIMINATO:
                                  return "Trash";
                                default:
                                  return "CircleX";
                              }
                            })()}
                            className="w-3.5 h-3.5 stroke-[1.7] mr-1"
                          />
                          {(() => {
                            switch (utente.stato) {
                              case STATO_UTENTI.ATTIVO:
                                return "Attivo";
                              case STATO_UTENTI.DISATTIVO:
                                return "Disattivo";
                              case STATO_UTENTI.SOSPESO:
                                return "Sospeso";
                              case STATO_UTENTI.ELIMINATO:
                                return "Eliminato";
                              default:
                                return "Unknown";
                            }
                          })()}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500">Tipo:</span>
                        <div className="mt-1">
                          {(() => {
                            switch (utente.tipo) {
                              case TIPO_UTENTI.SUPERADMIN:
                                return "Superadmin";
                              case TIPO_UTENTI.AGENZIA:
                                return "Agenzia";
                              case TIPO_UTENTI.PUNTOVENDITA:
                                return "Punto Vendita";
                              case TIPO_UTENTI.GUEST:
                                return "Guest";
                              case TIPO_UTENTI.GDO:
                                return "GDO";
                              case TIPO_UTENTI.CATEGORY:
                                return "Category";
                              case TIPO_UTENTI.MARKETING:
                                return "Marketing";
                              case TIPO_UTENTI.IT:
                                return "IT";
                              default:
                                return "Unknown";
                            }
                          })()}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500">Canale:</span>
                        <div className="flex items-center mt-1">
                          <Lucide
                            icon={(() => {
                              switch (utente?.canali_interazione?.[0]?.tipo_canaliinterazione) {
                                case "WHATSAPP":
                                  return "MessageCircle";
                                case "EMAIL":
                                  return "Mail";
                                case "TELEGRAM":
                                  return "Send";
                                case "FACEBOOK":
                                  return "MessageCircle";
                                case "INSTAGRAM":
                                  return "Camera";
                                case "LINKEDIN":
                                  return "Briefcase";
                                case "GOOGLE":
                                  return "Globe";
                                case "SMS":
                                  return "Smartphone";
                                default:
                                  return "User";
                              }
                            })()}
                            className={clsx("w-4 h-4 mr-1", {
                              "text-green-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "WHATSAPP",
                              "text-blue-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "EMAIL",
                              "text-blue-400": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "TELEGRAM",
                              "text-blue-600": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "FACEBOOK",
                              "text-pink-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "INSTAGRAM",
                              "text-blue-700": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "LINKEDIN",
                              "text-red-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "GOOGLE",
                              "text-yellow-500": utente?.canali_interazione?.[0]?.tipo_canaliinterazione === "SMS",
                              "text-gray-500": !utente?.canali_interazione?.[0]?.tipo_canaliinterazione
                            })}
                          />
                          {(() => {
                            switch (utente?.canali_interazione?.[0]?.tipo_canaliinterazione) {
                              case "WHATSAPP":
                                return "WhatsApp";
                              case "EMAIL":
                                return "Email";
                              case "TELEGRAM":
                                return "Telegram";
                              case "FACEBOOK":
                                return "Facebook";
                              case "INSTAGRAM":
                                return "Instagram";
                              case "LINKEDIN":
                                return "LinkedIn";
                              case "GOOGLE":
                                return "Google";
                              case "SMS":
                                return "SMS";
                              default:
                                return "Interno";
                            }
                          })()}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500">Registrato:</span>
                        <div className="mt-1 text-xs">
                          {dayjs(utente.createdat).locale("it").format("DD/MM/YYYY")}
                        </div>
                      </div>
                    </div>

                    {(utente.ruolo_gdo || utente.punto_vendita_collegato) && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <div className="flex flex-wrap gap-2">
                          {utente.ruolo_gdo && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {utente.ruolo_gdo.ruolo.replace("_", " ")}
                            </span>
                          )}
                          {utente.punto_vendita_collegato && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {utente.punto_vendita_collegato.nome}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col-reverse flex-wrap items-center p-3 sm:p-5 flex-reverse gap-y-2 sm:flex-row">
                {/* Informazioni sulla paginazione */}
                <div className="text-xs sm:text-sm text-slate-500 mr-auto text-center sm:text-left">
                  {dataUtentiPaginated?.isLoading ? (
                    "Caricamento..."
                  ) : (
                    <span className="hidden sm:inline">
                      Mostrando {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, dataUtentiPaginated?.data?.total || 0)} di {dataUtentiPaginated?.data?.total || 0} utenti
                    </span>
                  )}
                  <span className="sm:hidden">
                    Pagina {currentPage} di {dataUtentiPaginated?.data?.total_pages || 1}
                  </span>
                </div>
                <Pagination className="flex-1 w-full mr-auto sm:w-auto">
                  <Pagination.Link
                    onClick={() => currentPage !== 1 && handlePageChange(1)}
                    className={currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Lucide icon="ChevronsLeft" className="w-4 h-4" />
                  </Pagination.Link>
                  <Pagination.Link
                    onClick={() => currentPage !== 1 && handlePageChange(currentPage - 1)}
                    className={currentPage === 1 ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Lucide icon="ChevronLeft" className="w-4 h-4" />
                  </Pagination.Link>

                  {/* Logica per mostrare le pagine */}
                  {(() => {
                    const totalPages = dataUtentiPaginated?.data?.total_pages || 1;
                    const pages = [];

                    // Mostra sempre la prima pagina
                    if (currentPage > 3) {
                      pages.push(
                        <Pagination.Link key={1} onClick={() => handlePageChange(1)}>
                          1
                        </Pagination.Link>
                      );
                      if (currentPage > 4) {
                        pages.push(<Pagination.Link key="ellipsis1">...</Pagination.Link>);
                      }
                    }

                    // Mostra le pagine intorno alla pagina corrente
                    const startPage = Math.max(1, currentPage - 2);
                    const endPage = Math.min(totalPages, currentPage + 2);

                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <Pagination.Link
                          key={i}
                          active={i === currentPage}
                          onClick={() => handlePageChange(i)}
                        >
                          {i}
                        </Pagination.Link>
                      );
                    }

                    // Mostra sempre l'ultima pagina
                    if (currentPage < totalPages - 2) {
                      if (currentPage < totalPages - 3) {
                        pages.push(<Pagination.Link key="ellipsis2">...</Pagination.Link>);
                      }
                      pages.push(
                        <Pagination.Link key={totalPages} onClick={() => handlePageChange(totalPages)}>
                          {totalPages}
                        </Pagination.Link>
                      );
                    }

                    return pages;
                  })()}

                  <Pagination.Link
                    onClick={() => currentPage < (dataUtentiPaginated?.data?.total_pages || 1) && handlePageChange(currentPage + 1)}
                    className={currentPage >= (dataUtentiPaginated?.data?.total_pages || 1) ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Lucide icon="ChevronRight" className="w-4 h-4" />
                  </Pagination.Link>
                  <Pagination.Link
                    onClick={() => currentPage < (dataUtentiPaginated?.data?.total_pages || 1) && handlePageChange(dataUtentiPaginated?.data?.total_pages || 1)}
                    className={currentPage >= (dataUtentiPaginated?.data?.total_pages || 1) ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    <Lucide icon="ChevronsRight" className="w-4 h-4" />
                  </Pagination.Link>
                </Pagination>
                <FormSelect
                  className="w-full sm:w-20 rounded-[0.5rem] text-xs sm:text-sm"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </FormSelect>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default withSessionCheck(GestioneUtenti);
