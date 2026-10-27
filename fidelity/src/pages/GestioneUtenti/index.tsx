import { FormCheck, FormField, FormInput, FormSelect } from "@/components/Base/Form";
import BarraFiltri from "@/components/Base/BarraFiltri";
import Badge from "@/components/Base/Badge";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { Dialog, Menu } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import ConfirmDialog from "@/components/ConfirmDialog";
import { PermissionGate } from "@/components/PermissionGate";
import withSessionCheck from "@/components/SessionChecker";
import { PERMISSIONS } from "@/constants/permissions";
// import users from "@/fakers/users";
import Button from "@/components/Base/Button";
import Table from "@/components/Base/Table";
import clsx from "clsx";
// import { useLoaderData } from "react-router-dom";
import PageError from "@/components/Base/PageError";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { formatData, formatDataOra } from "@/utils/format";
import { useFetchAllGDO, useFetchAllRuoliGDO, useFetchAllUtentiPaginated, useFetchPuntiVenditaFromIdGDO } from "@/query/query";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation } from "@tanstack/react-query";
import dayjs from "dayjs";
import { saveAs } from "file-saver";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { STATO_UTENTI, TIPO_UTENTI, UTENTE_GENERE } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { CanaliInterazioneAttributes } from "../../../lib/types";
import { GDOResponseDTO, PuntoVenditaResponseDTO, RuoloUtenteGDOResponseDTO, UtenteResponseDTO } from "../../../server/core/dto";
import { useUser } from "../../context/UserContext";
import { useNotification } from "../../context/NotificationContext";
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

/** Colonne della tabella desktop: selezione, nome, canale, stato, registrazione, tipo, ruolo GDO, punto vendita, azioni. */
const NUMERO_COLONNE = 9;

const ICONE_CANALE: Record<string, string> = {
  WHATSAPP: "MessageCircle",
  EMAIL: "Mail",
  TELEGRAM: "Send",
  FACEBOOK: "MessageCircle",
  INSTAGRAM: "Camera",
  LINKEDIN: "Briefcase",
  GOOGLE: "Globe",
  SMS: "Smartphone",
};

const ETICHETTE_CANALE: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "Email",
  TELEGRAM: "Telegram",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  GOOGLE: "Google",
  SMS: "SMS",
};

const ETICHETTE_TIPO: Record<string, string> = {
  [TIPO_UTENTI.SUPERADMIN]: "Superadmin",
  [TIPO_UTENTI.AGENZIA]: "Agenzia",
  [TIPO_UTENTI.PUNTOVENDITA]: "Punto Vendita",
  [TIPO_UTENTI.GUEST]: "Guest",
  [TIPO_UTENTI.GDO]: "GDO",
  [TIPO_UTENTI.CATEGORY]: "Category",
  [TIPO_UTENTI.MARKETING]: "Marketing",
  [TIPO_UTENTI.IT]: "IT",
};

const etichettaTipo = (tipo?: string | null) => (tipo && ETICHETTE_TIPO[tipo]) || "Unknown";

/** Canale da cui è arrivato l'utente: icona ed etichetta ("Interno" se non ce n'è uno). */
const CanaleArrivo = ({ tipo }: { tipo?: string | null }) => (
  <span className="flex items-center gap-2 whitespace-nowrap">
    <Lucide icon={(tipo && ICONE_CANALE[tipo]) || "User"} aria-hidden="true" className="h-4 w-4 text-slate-500" />
    {(tipo && ETICHETTE_CANALE[tipo]) || "Interno"}
  </span>
);

const GestioneUtenti: React.FC = () => {
  const puntiVendita = useFetchPuntiVenditaFromIdGDO();
  const [allChecked, setAllChecked] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUtente, setSelectedUtente] = useState<any>(null);
  const [dialogUserCreationOpen, setDialogUserCreationOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rateLimitDialogOpen, setRateLimitDialogOpen] = useState(false);
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
  const { showNotification } = useNotification();
  const { data: allRuoliGDO } = useFetchAllRuoliGDO();
  const { data: allGDO } = useFetchAllGDO();
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
      showNotification("Utente eliminato con successo", { variant: "success" });
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
      showNotification(error?.message || "Errore durante l'eliminazione dell'utente", { variant: "error" });
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
      showNotification("Utente creato con successo", { variant: "success" });
      // Vai alla prima pagina per vedere il nuovo utente
      setCurrentPage(1);
      dataUtentiPaginated.refetch();
      setDialogUserCreationOpen(false);
      reset(); // Reset del form dopo la creazione
    },
    onError: (error: any) => {
      if (error.error === "REGISTRATION_RATE_LIMIT_EXCEEDED") {
        setRateLimitDialogOpen(true);
      } else {
        showNotification(error?.message || "Errore durante la creazione dell'utente", { variant: "error" });
      }
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
      showNotification("Utente aggiornato con successo", { variant: "success" });
      dataUtentiPaginated.refetch();
      setEditDialogOpen(false);
      setSelectedUserForEdit(null);
      resetEdit();
    },
    onError: (error: any) => {
      showNotification(error?.message || "Errore durante l'aggiornamento dell'utente", { variant: "error" });
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

  const filtriAttivi = Boolean(filters.searchTerm || tipoUtente || stato || sesso);
  const statoVuoto = filtriAttivi ? (
    <EmptyState
      compatta
      icon="SearchX"
      title="Nessun risultato"
      description="Nessun utente corrisponde alla ricerca o ai filtri."
      buttonText="Azzera filtri"
      buttonIcon="X"
      onButtonClick={resetFilters}
    />
  ) : (
    <EmptyState compatta icon="UserX" title="Nessun utente trovato" description="Non ci sono utenti da mostrare." />
  );

  return (
    <>
      {/* Il server non indica fra quanto si può riprovare: nessuna durata mostrata */}
      <Dialog open={rateLimitDialogOpen} onClose={() => setRateLimitDialogOpen(false)}>
        <Dialog.Panel>
          <Dialog.Title>
            <Lucide icon="Timer" aria-hidden="true" className="h-5 w-5 text-warning" />
            Limite di richieste superato
          </Dialog.Title>
          <Dialog.Description className="text-sm text-slate-600">
            Hai superato il limite di richieste al server. Attendi qualche minuto prima di riprovare.
          </Dialog.Description>
          <Dialog.Footer>
            <Button variant="primary" onClick={() => setRateLimitDialogOpen(false)}>
              Ho capito
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Elimina utente"
        description={
          <>
            <p>Sei sicuro di voler eliminare questo utente? Questa azione non può essere annullata.</p>
            {selectedUtente && (
              <div className="mt-3 rounded-control border border-slate-200 bg-slate-50 p-3">
                <div className="font-medium text-slate-800">
                  {selectedUtente.nome} {selectedUtente.cognome}
                </div>
                {selectedUtente.email && <div className="text-slate-500">{selectedUtente.email}</div>}
              </div>
            )}
          </>
        }
        confirmLabel="Elimina"
        loading={eliminaUtenteMutation.isPending}
        onClose={() => {
          if (!eliminaUtenteMutation.isPending) {
            setDeleteDialogOpen(false);
          }
        }}
        onConfirm={() => {
          eliminaUtenteMutation.mutate({ id: selectedUtente.id, tipoUtente: selectedUtente.tipo });
        }}
      />

      {/* Dialog di modifica utente */}
      <Dialog size="xl" open={editDialogOpen} onClose={() => {
        if (!updateUtenteMutation.isPending) {
          setEditDialogOpen(false);
          setSelectedUserForEdit(null);
        }
      }}>
        <Dialog.Panel>
          <Dialog.Title>
            <Lucide icon="User" aria-hidden="true" className="h-5 w-5 text-primary" />
            Modifica utente
          </Dialog.Title>
          <Dialog.Description>
            <form onSubmit={handleSubmitEdit(onSubmitEditForm)}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField etichetta="Nome" obbligatorio errore={errorsEdit.nome?.message}>
                  <FormInput
                    {...registerEdit("nome")}
                    type="text"
                    placeholder="Inserisci il nome"
                    className={clsx(errorsEdit.nome && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Cognome" obbligatorio errore={errorsEdit.cognome?.message}>
                  <FormInput
                    {...registerEdit("cognome")}
                    type="text"
                    placeholder="Inserisci il cognome"
                    className={clsx(errorsEdit.cognome && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Email" obbligatorio errore={errorsEdit.email?.message}>
                  <FormInput
                    {...registerEdit("email")}
                    type="email"
                    autoComplete="email webauthn"
                    placeholder="Inserisci l'email"
                    className={clsx(errorsEdit.email && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Telefono" errore={errorsEdit.telefono?.message}>
                  <FormInput
                    {...registerEdit("telefono")}
                    type="tel"
                    placeholder="Inserisci il telefono"
                    className={clsx(errorsEdit.telefono && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Data di Nascita" obbligatorio errore={errorsEdit.dataDiNascita?.message}>
                  <FormInput
                    {...registerEdit("dataDiNascita")}
                    type="date"
                    className={clsx(errorsEdit.dataDiNascita && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Residenza" obbligatorio errore={errorsEdit.residenza?.message}>
                  <FormInput
                    {...registerEdit("residenza")}
                    type="text"
                    placeholder="Inserisci la residenza"
                    className={clsx(errorsEdit.residenza && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Sesso" errore={errorsEdit.sesso?.message}>
                  <FormSelect
                    {...registerEdit("sesso")}
                  >
                    <option value="">Non specificato</option>
                    {Object.entries(UTENTE_GENERE).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField etichetta="Stato Utente" obbligatorio errore={errorsEdit.statoUtente?.message}>
                  <FormSelect
                    {...registerEdit("statoUtente")}
                    className={clsx(errorsEdit.statoUtente && "border-danger")}
                  >
                    {Object.keys(STATO_UTENTI).map((key) => (
                      <option key={key} value={STATO_UTENTI[key as keyof typeof STATO_UTENTI]}>
                        {STATO_UTENTI[key as keyof typeof STATO_UTENTI]}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField className="col-span-1 sm:col-span-2" etichetta="Tipo Utente" obbligatorio errore={errorsEdit.tipoUtente?.message}>
                  <FormSelect
                    {...registerEdit("tipoUtente")}
                    className={clsx(errorsEdit.tipoUtente && "border-danger")}
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
                </FormField>

                {/* Campo GDO - mostrato per tutti tranne SUPERADMIN */}
                {watchEdit("tipoUtente") && watchEdit("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <FormField className="col-span-1 sm:col-span-2" etichetta="GDO da associare" obbligatorio errore={errorsEdit.gdoScelta?.message}>
                    <FormSelect
                      {...registerEdit("gdoScelta")}
                      className={clsx(errorsEdit.gdoScelta && "border-danger")}
                    >
                      <option value="">Seleziona una GDO</option>
                      {allGDO?.map((gdo: GDOResponseDTO) => (
                        <option key={gdo.id} value={gdo.id}>
                          {gdo.nome} {gdo.ragione_sociale ? `(${gdo.ragione_sociale})` : ''}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                )}

                {/* Campo Ruolo - mostrato per tutti tranne SUPERADMIN */}
                {watchEdit("tipoUtente") && watchEdit("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <FormField className="col-span-1 sm:col-span-2" etichetta="Ruolo (opzionale)" errore={errorsEdit.ruolo_gdo?.message}>
                    <FormSelect
                      {...registerEdit("ruolo_gdo")}
                      className={clsx(errorsEdit.ruolo_gdo && "border-danger")}
                    >
                      {allRuoliGDO?.map((ruolo: RuoloUtenteGDOResponseDTO) => (
                        <option key={ruolo.id} value={ruolo.id}>
                          {ruolo.ruolo.replace("_", " ")}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                )}

                {/* Campo Punto Vendita - mostrato solo se il tipo utente è PUNTOVENDITA */}
                {watchEdit("tipoUtente") === TIPO_UTENTI.PUNTOVENDITA && (
                  <FormField className="col-span-1 sm:col-span-2" etichetta="Punto Vendita da collegare" obbligatorio errore={errorsEdit.idPuntoVendita?.message}>
                    <FormSelect
                      {...registerEdit("idPuntoVendita")}
                      className={clsx(errorsEdit.idPuntoVendita && "border-danger")}
                    >
                      <option value="">Seleziona un punto vendita</option>
                      {puntiVendita?.data?.map((punto: PuntoVenditaResponseDTO) => (
                        <option key={punto.id} value={punto.id}>
                          {punto.nome}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                )}
              </div>
            </form>
          </Dialog.Description>
          <Dialog.Footer>
            <Button
              variant="outline-secondary"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedUserForEdit(null);
                resetEdit();
              }}
              disabled={updateUtenteMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitEdit(onSubmitEditForm)}
              loading={updateUtenteMutation.isPending}
            >
              Salva modifiche
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      <Dialog size="xl" open={dialogUserCreationOpen} onClose={() => {
        setDialogUserCreationOpen(false);
      }}>
        <Dialog.Panel>
          <Dialog.Title>Crea nuovo utente</Dialog.Title>
          <form onSubmit={handleSubmit(onSubmitUserForm)}>
            <Dialog.Description>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField etichetta="Nome" obbligatorio errore={errors.nome?.message}>
                  <FormInput
                    {...register("nome")}
                    type="text"
                    placeholder="Inserisci il nome"
                    className={clsx(errors.nome && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Cognome" obbligatorio errore={errors.cognome?.message}>
                  <FormInput
                    {...register("cognome")}
                    type="text"
                    placeholder="Inserisci il cognome"
                    className={clsx(errors.cognome && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Email" obbligatorio errore={errors.email?.message}>
                  <FormInput
                    {...register("email")}
                    type="email"
                    autoComplete="email webauthn"
                    placeholder="Inserisci l'email"
                    className={clsx(errors.email && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Password" obbligatorio errore={errors.password?.message}>
                  <FormInput
                    {...register("password")}
                    type="password"
                    placeholder="Inserisci la password"
                    className={clsx(errors.password && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Data di Nascita" obbligatorio errore={errors.dataDiNascita?.message}>
                  <FormInput
                    {...register("dataDiNascita")}
                    type="date"
                    className={clsx(errors.dataDiNascita && "border-danger")}
                  />
                </FormField>
                <FormField etichetta="Residenza" obbligatorio errore={errors.residenza?.message}>
                  <FormInput
                    {...register("residenza")}
                    type="text"
                    placeholder="Inserisci la residenza"
                    className={clsx(errors.residenza && "border-danger")}
                  />
                </FormField>
                <FormField className="col-span-1 sm:col-span-2" etichetta="Tipo Utente" obbligatorio errore={errors.tipoUtente?.message}>
                  <FormSelect
                    {...register("tipoUtente")}
                    className={clsx(errors.tipoUtente && "border-danger")}
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
                </FormField>

                {/* Campo Ruolo - mostrato per tutti tranne SUPERADMIN */}

                {watch("tipoUtente") === TIPO_UTENTI.PUNTOVENDITA && (
                  <FormField className="col-span-1 sm:col-span-2" etichetta="Punto Vendita da collegare" obbligatorio errore={errors.idPuntoVendita?.message}>
                    <FormSelect
                      {...register("idPuntoVendita")}
                      className={clsx(errors.idPuntoVendita && "border-danger")}
                    >
                      <option value="">Seleziona un punto vendita</option>
                      {puntiVendita?.data?.map((punto: PuntoVenditaResponseDTO) => (
                        <option key={punto.id} value={punto.id}>
                          {punto.nome}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                )}
                {watch("tipoUtente") && watch("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <FormField className="col-span-1 sm:col-span-2" etichetta="GDO da associare" obbligatorio errore={errors.gdoScelta?.message}>
                    <FormSelect
                      {...register("gdoScelta")}
                      className={clsx(errors.gdoScelta && "border-danger")}
                    >
                      <option value="">Seleziona una GDO</option>
                      {allGDO?.map((gdo: GDOResponseDTO) => (
                        <option key={gdo.id} value={gdo.id}>
                          {gdo.nome} {gdo.ragione_sociale ? `(${gdo.ragione_sociale})` : ''}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                )}
                {watch("tipoUtente") && watch("tipoUtente") !== TIPO_UTENTI.SUPERADMIN && (
                  <FormField className="col-span-1 sm:col-span-2" etichetta="Ruolo (opzionale)" errore={errors.ruolo_gdo?.message}>
                    <FormSelect
                      {...register("ruolo_gdo")}
                      className={clsx(errors.ruolo_gdo && "border-danger")}
                    >
                      <option value="">Seleziona un ruolo (opzionale)</option>
                      {allRuoliGDO?.map((ruolo: RuoloUtenteGDOResponseDTO) => (
                        <option key={ruolo.id} value={ruolo.id}>
                          {ruolo.ruolo.replace("_", " ")}
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>
                )}
                <FormField etichetta="Sesso" errore={errors.sesso?.message}>
                  <FormSelect
                    {...register("sesso")}
                  >
                    <option value="">Non specificato</option>
                    {Object.entries(UTENTE_GENERE).map(([key, value]) => (
                      <option key={key} value={value}>{value}</option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField etichetta="Stato Utente" obbligatorio errore={errors.statoUtente?.message}>
                  <FormSelect
                    {...register("statoUtente")}
                    className={clsx(errors.statoUtente && "border-danger")}
                  >
                    {Object.keys(STATO_UTENTI).map((key) => (
                      <option key={key} value={STATO_UTENTI[key as keyof typeof STATO_UTENTI]}>
                        {STATO_UTENTI[key as keyof typeof STATO_UTENTI]}
                      </option>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField etichetta="Telefono" errore={errors.telefono?.message}>
                  <FormInput
                    {...register("telefono")}
                    type="text"
                    placeholder="Inserisci il numero di telefono"
                    className={clsx(errors.telefono && "border-danger")}
                  />
                </FormField>
              </div>
            </Dialog.Description>
            <Dialog.Footer>
              <Button
                variant="outline-secondary"
                onClick={() => {
                  setDialogUserCreationOpen(false);
                }}
                type="button"
              >
                Annulla
              </Button>
              <Button variant="primary" type="submit" loading={registerUtenteMutation.isPending}>Crea</Button>
            </Dialog.Footer>
          </form>
        </Dialog.Panel>
      </Dialog>
      <Pagina
        titolo="Gestione Utenti"
        descrizione="Gestisci e amministra tutti gli utenti del sistema con controllo completo su ruoli, permessi e stati account"
        azioni={
          <PermissionGate permission={PERMISSIONS.UTENTI.CREA} mode="disable">
            <Button
              variant="primary"
              onClick={() => {
                setDialogUserCreationOpen(true);
              }}
            >
              <Lucide icon="Plus" aria-hidden="true" className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Aggiungi un nuovo utente</span>
              <span className="sm:hidden">Nuovo utente</span>
            </Button>
          </PermissionGate>
        }
      >
        <Sezione senzaPadding titolo="Utenti" descrizione="Utenti registrati, con il loro tipo, ruolo e stato">
          <BarraFiltri
            destra={
              <PermissionGate permission={PERMISSIONS.UTENTI.ESPORTA} mode="disable">
                <Menu className="inline-block text-left">
                  <Menu.Button as={Button} size="sm" variant="outline-secondary">
                    <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Esporta come</span>
                    <span className="sm:hidden">Esporta</span>
                    <Lucide icon="ChevronDown" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
                  </Menu.Button>
                  <Menu.Items className="w-40">
                    <Menu.Item onClick={() => exportData('pdf')}>
                      <Lucide icon="FileText" aria-hidden="true" className="mr-2 h-4 w-4" />
                      PDF
                    </Menu.Item>
                    <Menu.Item onClick={() => exportData('csv')}>
                      <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-2 h-4 w-4" />
                      CSV
                    </Menu.Item>
                    <Menu.Item onClick={() => exportData('xlsx')}>
                      <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-2 h-4 w-4" />
                      Excel
                    </Menu.Item>
                    <Menu.Item onClick={() => exportData('xls')}>
                      <Lucide icon="FileSpreadsheet" aria-hidden="true" className="mr-2 h-4 w-4" />
                      Excel (legacy)
                    </Menu.Item>
                    <Menu.Item onClick={() => exportData('json')}>
                      <Lucide icon="FileJson2" aria-hidden="true" className="mr-2 h-4 w-4" />
                      JSON
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
              </PermissionGate>
            }
          >
            <CampoRicerca
              etichetta="Cerca utenti"
              placeholder="Cerca utenti"
              value={filters.searchTerm ?? ""}
              onChange={(valore) => {
                onSubmitFilters({ ...filters, searchTerm: valore });
              }}
            />
            {/* Tre filtri: select in linea (STANDARD §4), applicati subito come prima */}
            <FormSelect
              formSelectSize="sm"
              aria-label="Stato"
              className="sm:w-36"
              value={stato}
              onChange={(e) => {
                onSubmitFilters({ ...filters, stato: e.target.value });
              }}
            >
              <option value="">Tutti gli stati</option>
              <option value="ATTIVO">Attivo</option>
              <option value="DISATTIVO">Disattivo</option>
            </FormSelect>
            <FormSelect
              formSelectSize="sm"
              aria-label="Tipo di utenti"
              className="sm:w-40"
              value={tipoUtente}
              onChange={(e) => {
                onSubmitFilters({ ...filters, tipoUtente: e.target.value });
              }}
            >
              <option value="">Tutti i tipi</option>
              {Object.keys(TIPO_UTENTI).map((key) => {
                const tipoKey = key as keyof typeof TIPO_UTENTI;
                return <option key={tipoKey} value={TIPO_UTENTI[tipoKey]}>{TIPO_UTENTI[tipoKey]}</option>
              })}
            </FormSelect>
            <FormSelect
              formSelectSize="sm"
              aria-label="Sesso"
              className="sm:w-40"
              value={sesso}
              onChange={(e) => {
                onSubmitFilters({ ...filters, sesso: e.target.value });
              }}
            >
              <option value="">Tutti i sessi</option>
              <option value="M">Maschio</option>
              <option value="F">Femmina</option>
              <option value="N">Non specificato</option>
            </FormSelect>
            {filtriAttivi && (
              <Button type="button" size="sm" variant="outline-secondary" onClick={resetFilters}>
                Azzera filtri
              </Button>
            )}
          </BarraFiltri>

          {/* Vista Desktop - Tabella */}
          <div className="hidden overflow-x-auto lg:block">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th className="w-5">
                    <FormCheck.Input
                      type="checkbox"
                      aria-label="Seleziona tutti gli utenti"
                      onChange={(e) => {
                        setAllChecked(e.target.checked);
                      }}
                    />
                  </Table.Th>
                  <Table.Th>Nome & Cognome</Table.Th>
                  <Table.Th>Canale di arrivo</Table.Th>
                  <Table.Th className="text-center">Stato</Table.Th>
                  <Table.Th>Data di registrazione</Table.Th>
                  <Table.Th>Tipo Utente</Table.Th>
                  <Table.Th>Ruolo GDO</Table.Th>
                  <Table.Th className="text-center">Punto Vendita</Table.Th>
                  <Table.Th className="w-20 text-right"><span className="sr-only">Azioni</span></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dataUtentiPaginated?.isLoading && (
                  <Table.Tr>
                    <Table.Td colSpan={NUMERO_COLONNE} className="py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center">
                        <Spinner etichetta="Caricamento utenti…" />
                      </div>
                    </Table.Td>
                  </Table.Tr>
                )}
                {dataUtentiPaginated?.isError && (
                  <Table.Tr>
                    <Table.Td colSpan={NUMERO_COLONNE}>
                      <PageError
                        compatta
                        titolo="Utenti non caricati"
                        motivo={(dataUtentiPaginated.error as Error)?.message || "Errore durante il recupero degli utenti"}
                        onRiprova={() => dataUtentiPaginated.refetch()}
                      />
                    </Table.Td>
                  </Table.Tr>
                )}
                {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={NUMERO_COLONNE} className="p-0">
                      {statoVuoto}
                    </Table.Td>
                  </Table.Tr>
                )}
                {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.map((utente: UtenteResponseDTO & {
                  canali_interazione: Array<CanaliInterazioneAttributes>;
                  ruolo_gdo?: { id: string; ruolo: string } | null;
                  punto_vendita_collegato?: { id: string; nome: string } | null;
                }, key: any) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <FormCheck.Input
                        type="checkbox"
                        aria-label={`Seleziona ${utente.nome_completo ?? "utente"}`}
                        checked={allChecked}
                        onChange={() => { }}
                      />
                    </Table.Td>
                    <Table.Td className="w-80">
                      <div className="flex items-center">
                        <div aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-100">
                          <Lucide icon="User" className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="ml-3.5">
                          <div className="whitespace-nowrap font-medium text-slate-800">
                            {utente.nome_completo}
                          </div>
                          <div className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                            {utente.email}
                          </div>
                        </div>
                      </div>
                    </Table.Td>
                    <Table.Td className="font-medium">
                      <CanaleArrivo tipo={utente?.canali_interazione?.[0]?.tipo_canaliinterazione} />
                    </Table.Td>
                    <Table.Td className="text-center">
                      <StatusBadge dominio="utente" stato={utente.stato} />
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap tabular-nums">
                      {formatDataOra(utente.createdat)}
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap">
                      {etichettaTipo(utente.tipo)}
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap">
                      {utente.ruolo_gdo ? (
                        <Badge variant="info" size="sm">
                          {utente.ruolo_gdo.ruolo.replace("_", " ")}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </Table.Td>
                    <Table.Td className="whitespace-nowrap text-center">
                      {utente.punto_vendita_collegato ? (
                        <Badge variant="secondary" size="sm">
                          {utente.punto_vendita_collegato.nome}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </Table.Td>
                    <Table.Td className="text-right">
                      <Menu className="inline-block text-left">
                        <Menu.Button
                          as={Button}
                          size="sm"
                          variant="outline-secondary"
                          aria-label={`Azioni utente ${utente.nome_completo ?? ""}`.trim()}
                        >
                          <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4" />
                        </Menu.Button>
                        <Menu.Items className="w-40">
                          <Menu.Item onClick={() => {
                            handleEditUser(utente);
                          }}>
                            <Lucide icon="User" aria-hidden="true" className="mr-2 h-4 w-4" />
                            Modifica
                          </Menu.Item>
                          <PermissionGate permission={PERMISSIONS.UTENTI.ELIMINA}>
                            <Menu.Item onClick={() => {
                              setDeleteDialogOpen(true);
                              setSelectedUtente(utente);
                            }} className="text-danger">
                              <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                              Elimina
                            </Menu.Item>
                          </PermissionGate>
                        </Menu.Items>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>

          {/* Vista Mobile - Card */}
          <div className="flex flex-col gap-4 p-4 lg:hidden">
            {dataUtentiPaginated?.isLoading && (
              <div className="flex items-center justify-center py-8 text-slate-500">
                <Spinner etichetta="Caricamento utenti…" />
              </div>
            )}
            {dataUtentiPaginated?.isError && (
              <PageError
                compatta
                titolo="Utenti non caricati"
                motivo={(dataUtentiPaginated.error as Error)?.message || "Errore durante il recupero degli utenti"}
                onRiprova={() => dataUtentiPaginated.refetch()}
              />
            )}

            {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.length === 0 && statoVuoto}

            {!dataUtentiPaginated?.isLoading && dataUtentiPaginated?.data?.utenti?.map((utente: UtenteResponseDTO & {
              canali_interazione: Array<CanaliInterazioneAttributes>;
              ruolo_gdo?: { id: string; ruolo: string } | null;
              punto_vendita_collegato?: { id: string; nome: string } | null;
            }, key: any) => (
              <div key={key} className="rounded-card border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                      <Lucide icon="User" className="h-5 w-5 text-slate-500" />
                    </div>
                    <div>
                      <h3 className="title-card">{utente.nome_completo}</h3>
                      <p className="text-sm text-slate-500">{utente.email}</p>
                    </div>
                  </div>
                  <Menu className="inline-block text-left">
                    <Menu.Button
                      as={Button}
                      size="sm"
                      variant="outline-secondary"
                      aria-label={`Azioni utente ${utente.nome_completo ?? ""}`.trim()}
                    >
                      <Lucide icon="EllipsisVertical" aria-hidden="true" className="h-4 w-4" />
                    </Menu.Button>
                    <Menu.Items className="w-40">
                      <Menu.Item onClick={() => {
                        handleEditUser(utente);
                      }}>
                        <Lucide icon="User" aria-hidden="true" className="mr-2 h-4 w-4" />
                        Modifica
                      </Menu.Item>
                      <PermissionGate permission={PERMISSIONS.UTENTI.ELIMINA}>
                        <Menu.Item onClick={() => {
                          setDeleteDialogOpen(true);
                          setSelectedUtente(utente);
                        }} className="text-danger">
                          <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
                          Elimina
                        </Menu.Item>
                      </PermissionGate>
                    </Menu.Items>
                  </Menu>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Stato:</span>
                    <div className="mt-1">
                      <StatusBadge dominio="utente" stato={utente.stato} />
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500">Tipo:</span>
                    <div className="mt-1">{etichettaTipo(utente.tipo)}</div>
                  </div>

                  <div>
                    <span className="text-slate-500">Canale:</span>
                    <div className="mt-1">
                      <CanaleArrivo tipo={utente?.canali_interazione?.[0]?.tipo_canaliinterazione} />
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500">Registrato:</span>
                    <div className="mt-1 text-xs tabular-nums">
                      {formatData(utente.createdat)}
                    </div>
                  </div>
                </div>

                {(utente.ruolo_gdo || utente.punto_vendita_collegato) && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <div className="flex flex-wrap gap-2">
                      {utente.ruolo_gdo && (
                        <Badge variant="info" size="sm">
                          {utente.ruolo_gdo.ruolo.replace("_", " ")}
                        </Badge>
                      )}
                      {utente.punto_vendita_collegato && (
                        <Badge variant="secondary" size="sm">
                          {utente.punto_vendita_collegato.nome}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <PaginazioneTabella
            totale={dataUtentiPaginated?.data?.total || 0}
            pagina={currentPage}
            dimensionePagina={pageSize}
            onCambiaPagina={handlePageChange}
            onCambiaDimensione={handlePageSizeChange}
          />
        </Sezione>
      </Pagina>
    </>
  );
};

export default withSessionCheck(GestioneUtenti);
