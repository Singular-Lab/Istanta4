import Alert from "@/components/Base/Alert";
import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Dropzone from "@/components/Base/Dropzone";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import Spinner from "@/components/Base/Spinner";
import StatusBadge from "@/components/Base/StatusBadge";
import ContestoLavorazioneFields from "@/components/ContestoLavorazioneFields";
import VisibilitaPromoFields from "@/components/VisibilitaPromoFields";
import EmptyState from "@/components/EmptyState";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import React, { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Await,
  useAsyncError,
  useLoaderData,
  useLocation,
  useNavigate,
  useRevalidator,
} from "react-router-dom";
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO } from "../../../../lib/enums";
import { ServerCall } from "../../../../lib/server_call";
import { FileItemKit } from "../../../../lib/types";
import {
  PromoResponseDTO,
  TracciatiResponseDTO,
  UpdatePromoDTO,
  type AreaResponseDTO,
  type CanaleResponseDTO,
} from "../../../../server/core/dto";
import LazyChart from "../../../components/Lazy/LazyChart";
import PermissionGate from "../../../components/PermissionGate";
import { withSessionCheckOptimized } from "../../../components/SessionChecker";
import { usePermissionContext } from '../../../context/PermissionContext';
import { useUser } from "../../../context/UserContext";
import { useContestoPerNuovaLavorazione, useFetchFunzionalita } from "../../../query/query";
import CardVolantino from "../../shared/CardVolantino";
import SpecificheLavorazione from "../../shared/SpecificheLavorazione";
import GestioneMomenti from "./GestioneMomenti";
import TracciatoCard from "./TracciatoCard";
import { formatData, formatDataOraEstesa } from "@/utils/format";
// Serve per leggere le date nel formato DD/MM/YYYY (scadenza imminente)
dayjs.extend(customParseFormat);

// Definizione per ComboBox
export type ComboBox = {
  tipo_field: "cmb";
  valore: Array<{ titolo: string; valore: string }>;
};

// Definizione per RadioButton
export type RadioButton = {
  tipo_field: "radio";
  valore: Array<{ titolo: string; valore: string }>;
};

export type CheckButton = {
  tipo_field: "check";
  valore: Array<{ titolo: string; valore: string }>;
};

// Definizione per TextField
export type TextField = {
  tipo_field: "text";
  valore: string;
};

// Definizione per il contesto di lavorazione
export type ContextLavorazione = {
  nome_field: string;
  titolo_field: string;
  dipendenze?: { nome_field: string; valore: string }[];
  /**
   * Se true -> nel dato finale (upload) il campo viene comunque incluso,
   * anche se "vuoto", con user_value: []
   * Se undefined (o false) -> se il valore è vuoto NON viene mandato nel dato finale.
   */
  nullable?: boolean;
} & (ComboBox | RadioButton | TextField | CheckButton);

/**
 * Helper per preparare il contesto da mandare in upload:
 * - Se il campo ha un valore (user_value non vuoto) => lo manteniamo così com'è
 * - Se il campo è nullable === true e NON ha valore => lo includiamo con user_value: ""
 * - Se nullable è undefined/false e non ha valore => NON lo includiamo nel risultato finale
 */
function buildContextForUpload(
  context: (ContextLavorazione & { user_value: any })[],
  fieldValues: { [key: string]: any },
  customLabelValue: string
): (ContextLavorazione & { user_value: any })[] {
  return context
    .map((c) => {
      let updated = { ...c };

      // Gestione speciale per idLabel + label personalizzata
      if (updated.nome_field === "idLabel" && fieldValues["idLabel"] === "lblpers") {
        updated = {
          ...updated,
          user_value: customLabelValue || updated.user_value,
        };
      }

      const hasValue =
        updated.user_value !== "" &&
        updated.user_value !== null &&
        updated.user_value !== undefined;

      if (hasValue) {
        // Ha un valore esplicito, lo inviamo così com'è
        return updated;
      }

      // if (updated.nullable === true) {
      //   return {
      //     ...updated,
      //     user_value: null,
      //   };
      // }

      // nullable undefined / false e valore vuoto => non mandare nulla
      return null;
    })
    .filter(
      (c): c is ContextLavorazione & { user_value: any } =>
        c !== null
    );
}

// Contesto per singolo file (modalità "per-file")
type FileContext = {
  context: (ContextLavorazione & { user_value: any })[];
  fieldValues: { [key: string]: any };
  customLabelValue: string;
};

// Interfacce per la visualizzazione volantini
interface VolantinoKit {
  guidId: string;
  titolo: string;
  nomeArea?: string;
  nomeCanale?: string;
  stato_lavorazione: string;
  files?: FileItemKit[];
}

// Segnaposto della lista volantini, con la stessa forma di CardVolantino
const VolantiniSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4">
        <Skeleton className="h-24 w-20 flex-shrink-0 rounded-control" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-3/5" />
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

// Riquadro di primo livello che porta a un'altra vista della promo: titolo e descrizione a sinistra, comando a destra
const SezioneCollegamento: React.FC<{
  icona: string;
  titolo: string;
  descrizione: string;
  azione: ReactNode;
  className?: string;
}> = ({ icona, titolo, descrizione, azione, className }) => (
  <Sezione aria-label={titolo} className={className}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <Lucide icon={icona} aria-hidden="true" className="mt-1 h-5 w-5 flex-none text-slate-500" />
        <div className="min-w-0">
          <h2 className="title-section">{titolo}</h2>
          <p className="text-sm text-slate-500">{descrizione}</p>
        </div>
      </div>
      <div className="flex flex-none items-center gap-2">{azione}</div>
    </div>
  </Sezione>
);

// Passa ai figli il messaggio dell'errore rigettato da un <Await> (stringa vuota se assente)
const ErroreAsync: React.FC<{ children: (messaggio: string) => React.ReactNode }> = ({ children }) => {
  const error = useAsyncError() as { message?: string } | undefined;
  return <>{children(error?.message || "")}</>;
};

type OrdineTracciati = "recenti" | "meno_recenti" | "nome_az" | "nome_za";

const ORDINI_TRACCIATI: Array<{ valore: OrdineTracciati; etichetta: string }> = [
  { valore: "recenti", etichetta: "Più recenti" },
  { valore: "meno_recenti", etichetta: "Meno recenti" },
  { valore: "nome_az", etichetta: "Nome A→Z" },
  { valore: "nome_za", etichetta: "Nome Z→A" },
];

/** Copia ordinata dei tracciati: per data di caricamento (senza data in fondo) o per nome visualizzato. */
const ordinaTracciati = (tracciati: TracciatiResponseDTO[], ordine: OrdineTracciati) => {
  const data = (t: TracciatiResponseDTO) => (t.createdat ? new Date(t.createdat).getTime() : NaN);
  const nome = (t: TracciatiResponseDTO) => t.nome || t.filename || "";
  return [...tracciati].sort((a, b) => {
    if (ordine === "nome_az" || ordine === "nome_za") {
      const confronto = nome(a).localeCompare(nome(b), "it", { numeric: true, sensitivity: "base" });
      return ordine === "nome_az" ? confronto : -confronto;
    }
    const [dataA, dataB] = [data(a), data(b)];
    if (Number.isNaN(dataA) || Number.isNaN(dataB)) {
      return Number(Number.isNaN(dataA)) - Number(Number.isNaN(dataB));
    }
    return ordine === "recenti" ? dataB - dataA : dataA - dataB;
  });
};

function Main() {
  const refDropzone = useRef<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissionContext();
  // Momenti e menabò si attivano per GDO dalle Impostazioni di produzione: finché la risposta non arriva restano nascosti
  const funzionalitaQuery = useFetchFunzionalita();
  const showMomenti = funzionalitaQuery.data?.momenti === true;
  const showMenabo = funzionalitaQuery.data?.menabo === true;
  const [idPromo, setIdPromo] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Modalità contesto
  const [useSharedContext, setUseSharedContext] = useState<boolean>(true);

  // Contesto condiviso
  const [fieldValues, setFieldValues] = useState<{ [key: string]: any }>({});
  const [contextLavorazione, setContextLavorazione] = useState<
    (ContextLavorazione & { user_value: any })[]
  >([]);
  const [customLabelValue, setCustomLabelValue] = useState<string>("");
  const MAX_CHAR_CUSTOM_LABEL = 40;
  // Contesto per-file
  const [fileContexts, setFileContexts] = useState<FileContext[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);

  const [isUpdating, setIsUpdating] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [ordineTracciati, setOrdineTracciati] = useState<OrdineTracciati>("recenti");
  const [editFormData, setEditFormData] = useState<
    UpdatePromoDTO & { id: string }
  >({} as UpdatePromoDTO & { id: string });
  const [abortController, setAbortController] = useState<AbortController | null>(
    null
  );

  // Errori di validazione per il contesto (shared)
  const [contextErrors, setContextErrors] = useState<{
    [fieldName: string]: string;
  }>({});

  // Errori di validazione per il contesto per-file
  const [fileContextErrors, setFileContextErrors] = useState<{
    [fileIndex: number]: { [fieldName: string]: string };
  }>({});

  // Contesto per la modalità di modifica promo
  const [editContextLavorazione, setEditContextLavorazione] = useState<
    (ContextLavorazione & { user_value: any })[]
  >([]);
  const [editFieldValues, setEditFieldValues] = useState<{ [key: string]: any }>({});
  const [editCustomLabelValue, setEditCustomLabelValue] = useState<string>("");
  const [editContextErrors, setEditContextErrors] = useState<{ [fieldName: string]: string }>({});
  const [editFieldErrors, setEditFieldErrors] = useState<{ [field: string]: string }>({});

  const { showNotification } = useNotification();
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const [currentOperationStatus, setCurrentOperationStatus] =
    useState<string>("");
  const [expandedErrorTracciatoId, setExpandedErrorTracciatoId] = useState<
    string | number | null
  >(null);
  const { user } = useUser()


  const getShortError = (error: string, maxLength = 200) => {
    if (!error) return "";
    if (error.length <= maxLength) return error;

    const idx = error.indexOf(" in ");
    if (idx > -1 && idx < maxLength) {
      return `${error.slice(0, idx).trim()}...`;
    }

    return `${error.slice(0, maxLength).trim()}...`;
  };

  const getFileType = (fileName: string): string => {
    const extension = fileName.split(".").pop();
    switch (extension) {
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      case "xls":
        return "application/vnd.ms-excel";
      default:
        return "application/octet-stream";
    }
  };

  useEffect(() => {
    const pathParts = location.pathname.split("/");
    const id = pathParts[pathParts.length - 1];
    setIdPromo(id);
  }, [location]);

  const {
    lavorazioni,
    volantini,
    datoGraficoPaginaLavorazioni,
  } = useLoaderData() as {
    lavorazioni: Promise<any[] | null>;
    volantini: Promise<VolantinoKit[] | null>;
    datoGraficoPaginaLavorazioni: Promise<any>;
    allAreeGDO: Promise<AreaResponseDTO[] | null>;
    allCanaliGDO: Promise<CanaleResponseDTO[] | null>;
  };

  const promoQuery = useQuery({
    queryKey: ["promo", idPromo],
    queryFn: async () => {
      if (!idPromo) return null;
      const result = await ServerCall.get<PromoResponseDTO>(
        `/promo/${idPromo}`
      );
      return result;
    },
    enabled: !!idPromo,
  });

  const currentPromoData = promoQuery.data;

  const tracciatiQuery = useQuery({
    queryKey: ["tracciatiPromo", idPromo],
    queryFn: async () => {
      if (!idPromo) return [];
      const result = await ServerCall.get<TracciatiResponseDTO[]>(
        `/tracciati/promo/${idPromo}?page=1&pageSize=20`
      );
      return result ?? [];
    },
    enabled: !!idPromo,
    placeholderData: (previousData) => previousData ?? [],
  });

  const isPromoFinalState = (stato?: STATO_PROMO | null) =>
    stato === STATO_PROMO.VALIDA ||
    stato === STATO_PROMO.VALIDA_CON_ERRORI ||
    stato === STATO_PROMO.ARCHIVIATA;

  const isExpired = currentPromoData?.validita_al
    ? dayjs().isAfter(dayjs(currentPromoData.validita_al), "day") ||
    isPromoFinalState(currentPromoData?.stato)
    : isPromoFinalState(currentPromoData?.stato);

  const downloadBlobXLSX = (blob: Blob, fileName = "file.xlsx") => {
    if (!blob) {
      console.error("Blob non valido");
      return;
    }
    const fileURL = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = fileURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(fileURL);
  };

  const handleDownload = (tracciato: TracciatiResponseDTO) => {
    if (!tracciato.id) {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Il file non è disponibile</div>
          </div>
        </div>
      );
      return;
    }

    const url = ServerCall.getUrl();
    const iframe = document.createElement("iframe");

    iframe.style.display = "none";
    iframe.src = `${url}/tracciati/${tracciato.id}/download`;

    document.body.appendChild(iframe);

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  const getFileSize = (sizeInBytes?: number): string => {
    if (!sizeInBytes) {
      return "0.00";
    }
    const sizeInMB = sizeInBytes / (1024 * 1024);
    return sizeInMB.toFixed(2);
  };

  const contextLavorazioneQuery = useQuery({
    queryKey: ["contestoPerImportazione", idPromo],
    queryFn: async () => {
      if (!idPromo) return [];
      await new Promise((resolve) => setTimeout(resolve, 300));
      const result = await ServerCall.get<
        (ContextLavorazione & { user_value: any })[]
      >(`/promo/contesto-importazione?guidId=${idPromo}`);
      return result;
    },
    enabled: !!idPromo,
  });
  const { data: dataContestoPerNuovaLavorazione, isLoading: isLoadingContestoPerNuovaLavorazione } = useContestoPerNuovaLavorazione();


  const refreshContent = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["promo", idPromo] }),
      queryClient.invalidateQueries({ queryKey: ["tracciatiPromo", idPromo] }),
      queryClient.invalidateQueries({ queryKey: ["lavorazioniInCorso"] }),
      // l'avviso di visibilita dei momenti dipende dalla promo
      queryClient.invalidateQueries({ queryKey: ["tracciatiMomenti", idPromo] }),
    ]);

    await Promise.all([
      promoQuery.refetch(),
      tracciatiQuery.refetch(),
      contextLavorazioneQuery.refetch(),
    ]);

    revalidator.revalidate();
  };

  // Helper per dipendenze
  const areDependenciesMet = (
    dipendenze: any[] | undefined,
    allFieldValues: any
  ) => {
    if (!dipendenze || dipendenze.length === 0) return true;
    return dipendenze.every((dependency: any) => {
      if (
        allFieldValues[dependency.nome_field] === undefined ||
        allFieldValues[dependency.nome_field] === ""
      ) {
        return false;
      }
      return allFieldValues[dependency.nome_field] === dependency.valore;
    });
  };

  // Inizializzazione contesto condiviso e per-file quando arrivano i dati dal server
  useEffect(() => {
    const data = contextLavorazioneQuery.data;
    if (!data || data.length === 0) return;

    // Shared context: se vuoto lo inizializzo
    if (useSharedContext && contextLavorazione.length === 0) {
      const initialContext = data.map((item) => ({
        ...item,
        user_value: item.user_value || "",
      }));

      const initialFieldValues: { [key: string]: any } = {};
      data.forEach((item) => {
        if (item.user_value) {
          initialFieldValues[item.nome_field] = item.user_value;
        }
      });

      setContextLavorazione(initialContext);
      setFieldValues(initialFieldValues);
      setCustomLabelValue("");
    }

    // Modalità per-file: se ci sono file ma non ci sono ancora contesti per tutti
    if (!useSharedContext && files.length > 0 && fileContexts.length < files.length) {
      setFileContexts((prev) => {
        const baseContext = data.map((item) => ({
          ...item,
          user_value: "",
        }));

        const newContexts = [...prev];
        for (let i = prev.length; i < files.length; i++) {
          newContexts[i] = {
            context: baseContext.map((c) => ({ ...c })), // copia
            fieldValues: {},
            customLabelValue: "",
          };
        }
        return newContexts;
      });
    }
  }, [
    contextLavorazioneQuery.data,
    useSharedContext,
    contextLavorazione.length,
    files.length,
    fileContexts.length,
  ]);

  const handleAddFile = (addedFiles: File[]) => {
    setFiles((prev) => {
      const newFiles = [...prev, ...addedFiles];

      // Se siamo in modalità per-file, creiamo contesti per ogni nuovo file (se abbiamo già i dati del server)
      if (!useSharedContext && contextLavorazioneQuery.data) {
        const data = contextLavorazioneQuery.data;
        setFileContexts((prevContexts) => {
          const baseContext = data.map((item) => ({
            ...item,
            user_value: "",
          }));
          const newContexts = [...prevContexts];
          for (let i = prevContexts.length; i < newFiles.length; i++) {
            newContexts[i] = {
              context: baseContext.map((c) => ({ ...c })),
              fieldValues: {},
              customLabelValue: "",
            };
          }
          return newContexts;
        });
      }

      return newFiles;
    });
  };

  const handleRemoveFile = () => {
    setFiles([]);
    setSelectedFileIndex(0);
    setFileContexts([]);

    // reset contesto condiviso allo stato "originale" del server
    const data = contextLavorazioneQuery.data;
    if (data && data.length > 0) {
      const resetContext = data.map((item) => ({
        ...item,
        user_value: item.user_value || "",
      }));

      const initialFieldValues: { [key: string]: any } = {};
      data.forEach((item) => {
        if (item.user_value) {
          initialFieldValues[item.nome_field] = item.user_value;
        }
      });

      setContextLavorazione(resetContext);
      setFieldValues(initialFieldValues);
      setCustomLabelValue("");
    } else {
      setContextLavorazione([]);
      setFieldValues({});
      setCustomLabelValue("");
    }

    setContextErrors({});
    setFileContextErrors({});

    if (abortController) {
      abortController.abort("Upload cancellato dall'utente");
    }
  };

  const handleRemoveSingleFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));

    if (!useSharedContext) {
      setFileContexts((prev) => prev.filter((_, i) => i !== index));
      setSelectedFileIndex((prevIndex) => {
        if (prevIndex >= index && prevIndex > 0) {
          return prevIndex - 1;
        }
        return 0;
      });

      setFileContextErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        // shift indici se vuoi mantenerli allineati, ma poiché rigeneriamo spesso i contesti, possiamo anche lasciarlo così
        return next;
      });
    }
  };

  const handleUploadTracciato = useMutation({
    mutationFn: async (filesToUpload: File[]) => {
      if (!idPromo) throw new Error("idPromo is null");
      if (!filesToUpload || filesToUpload.length === 0)
        throw new Error("Files are null");

      const newAbortController = new AbortController();
      setAbortController(newAbortController);

      const getUrl = ServerCall.getUrl();
      const out: TracciatiResponseDTO[] = [];

      for (const [index, file] of filesToUpload.entries()) {
        let contextFiltrato: (ContextLavorazione & { user_value: any })[] = [];

        if (useSharedContext) {
          contextFiltrato = buildContextForUpload(
            contextLavorazione,
            fieldValues,
            customLabelValue
          );
        } else {
          const fc = fileContexts[index];
          contextFiltrato = buildContextForUpload(
            fc?.context || [],
            fc?.fieldValues || {},
            fc?.customLabelValue || ""
          );
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("context", JSON.stringify(contextFiltrato));

        // Garantisce che il token CSRF esista prima di inviare
        await ServerCall.ensureCSRFToken();
        let csrfToken = ServerCall.getCSRFToken();

        const doUpload = () => fetch(`${getUrl}/uploadTracciato/${idPromo}`, {
          method: "POST",
          body: formData,
          credentials: "include",
          signal: newAbortController.signal,
          headers: {
            "X-Requested-With": "XMLHttpRequest",
            "x-csrf-token": csrfToken ?? "",
          },
        });

        let result = await doUpload();

        // Retry automatico in caso di errore CSRF (token scaduto/mancante)
        if (result.status === 403) {
          const errPayload = await result.clone().json().catch(() => null);
          const errCode = errPayload?.code as string | undefined;
          const isCsrf =
            errCode === 'CSRF_TOKEN_MISSING' ||
            errCode === 'CSRF_TOKEN_INVALID' ||
            errCode === 'CSRF_TOKEN_EXPIRED' ||
            String(errPayload?.message ?? '').toLowerCase().includes('csrf');
          if (isCsrf) {
            csrfToken = await ServerCall.ensureCSRFToken(true);
            result = await doUpload();
          }
        }

        if (!result.ok) {
          const text = await result.text().catch(() => "");
          let corpo: { message?: string } | null = null;
          try {
            corpo = JSON.parse(text);
          } catch {
            // corpo non JSON: resta nei details
          }
          throw new Error(
            JSON.stringify({
              success: false,
              file: file.name,
              status: result.status,
              message: corpo?.message || "Upload del tracciato non riuscito",
              details: corpo?.message ? null : text || null,
            })
          );
        }

        const res = (await result.json()) as
          | TracciatiResponseDTO
          | { message: string };

        if ("message" in res) {
          throw new Error(`Upload fallito per "${file.name}": ${res.message}`);
        }

        out.push(res);
      }

      return out;
    },

    onSuccess: async () => {
      setIsUploading(false);
      setFiles([]);
      setContextLavorazione([]);
      setFileContexts([]);
      setSelectedFileIndex(0);
      setContextErrors({});
      setFileContextErrors({});
      await refreshContent();
    },

    onError: (error: any) => {
      let errorMessage: {
        success: boolean;
        file: string;
        status: number;
        message: string;
        details?: string | { message?: string };
      } = {
        success: false,
        file: "",
        status: 0,
        message: "",
        details: "",
      };
      try {
        errorMessage = JSON.parse(error.message);
        // Try to parse details if it's a JSON string
        if (
          errorMessage.details &&
          typeof errorMessage.details === "string" &&
          errorMessage.details.startsWith("{")
        ) {
          try {
            errorMessage.details = JSON.parse(errorMessage.details);
          } catch {
            // leave as string if parsing fails
          }
        }
      } catch {
        errorMessage = {
          success: false,
          file: "",
          status: 0,
          message: error?.message || "Errore sconosciuto",
          details: "",
        };
      }

      let detailsText = "";
      if (typeof errorMessage.details === "string") {
        detailsText = errorMessage.details;
      } else if (
        errorMessage.details &&
        typeof errorMessage.details === "object" &&
        "message" in errorMessage.details
      ) {
        detailsText = errorMessage.details.message || "";
      }

      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'upload del tracciato</div>
            <div className="mt-1 text-slate-500">{errorMessage.message}</div>
            {detailsText && (
              <div className=" text-xs text-danger">{detailsText}</div>
            )}
          </div>
        </div>
      );
      setIsUploading(false);
    },

    mutationKey: ["uploadTracciato"],
  });

  const updatePromoMutation = useMutation({
    mutationFn: async (data: UpdatePromoDTO & { id: string }) => {
      if (!idPromo) throw new Error("idPromo is null");
      const result = await ServerCall.put<PromoResponseDTO & { avvisi?: string[] }>(
        `/promo/${data.id}`,
        data
      );
      return result;
    },
    onSuccess: async (result) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Lavorazione aggiornata con successo</div>
          </div>
        </div>
      );
      if (result?.avvisi?.length) {
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="TriangleAlert" className="text-warning w-8 h-8" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Promozione aggiornata con avvisi</div>
              <div className="mt-1 text-slate-500">{result.avvisi.join(" ")}</div>
            </div>
          </div>,
          { variant: "warning", duration: 10000 }
        );
      }
      setIsEditing(false);
      setEditFormData({} as UpdatePromoDTO & { id: string });
      await refreshContent();
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'aggiornamento</div>
            <div className="mt-1 text-slate-500">{error.message}</div>
          </div>
        </div>
      );
    },
    mutationKey: ["updatePromo"],
  });

  const deleteTracciatoMutation = useMutation({
    mutationFn: async (idTracciato: string) => {
      return ServerCall.delete<{ success: boolean; message?: string }>(
        `/tracciati/${idTracciato}`
      );
    },
    onSuccess: async () => {
      await refreshContent();
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Tracciato eliminato con successo</div>
          </div>
        </div>
      );
    },
    onError: (error: any) => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errore durante l'eliminazione del tracciato</div>
            <div className="mt-1 text-slate-500">{error.message}</div>
          </div>
        </div>
      );
    },
    mutationKey: ["deleteTracciato", idPromo],
  });

  const handleDeleteTracciato = (tracciato: TracciatiResponseDTO) => {
    if (!tracciato.id) {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Tracciato non valido</div>
          </div>
        </div>
      );
      return;
    }

    deleteTracciatoMutation.mutate(String(tracciato.id));
  };

  // Gestione cambi input contesto (sia condiviso che per-file)
  const handleInputChange = (fieldName: string, value: any) => {
    setIsUpdating(true);

    if (useSharedContext) {
      setFieldValues((prevValues) => {
        const nextFieldValues = { ...prevValues, [fieldName]: value };

        setContextLavorazione((prevContext) =>
          prevContext
            .map((context) => {
              if (context.nome_field === fieldName) {
                return { ...context, user_value: value };
              }
              return context;
            })
            .map((context) => {
              if (
                !areDependenciesMet(context.dipendenze || [], nextFieldValues) &&
                context.user_value
              ) {
                return { ...context, user_value: null };
              }
              return context;
            })
        );

        return nextFieldValues;
      });

      // pulisco l'errore per questo campo (se c'era)
      setContextErrors((prev) => {
        if (!prev[fieldName]) return prev;
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    } else {
      // modalità per-file
      setFileContexts((prev) =>
        prev.map((fc, idx) => {
          if (idx !== selectedFileIndex) return fc;

          const nextFieldValues = { ...fc.fieldValues, [fieldName]: value };
          const nextContext = fc.context
            .map((context) => {
              if (context.nome_field === fieldName) {
                return { ...context, user_value: value };
              }
              return context;
            })
            .map((context) => {
              if (
                !areDependenciesMet(context.dipendenze || [], nextFieldValues) &&
                context.user_value
              ) {
                return { ...context, user_value: null };
              }
              return context;
            });

          return {
            ...fc,
            fieldValues: nextFieldValues,
            context: nextContext,
          };
        })
      );

      // pulisco l'errore per questo campo nel file corrente
      setFileContextErrors((prev) => {
        const current = prev[selectedFileIndex];
        if (!current || !current[fieldName]) return prev;

        const nextForFile = { ...current };
        delete nextForFile[fieldName];

        const next = { ...prev };
        if (Object.keys(nextForFile).length === 0) {
          delete next[selectedFileIndex];
        } else {
          next[selectedFileIndex] = nextForFile;
        }
        return next;
      });
    }

    setTimeout(() => {
      setIsUpdating(false);
    }, 0);
  };

  // Validazione contesto condiviso
  // Campi obbligatori e lunghezza della label personalizzata di un contesto
  const erroriContesto = (
    currentContext: (ContextLavorazione & { user_value: any })[],
    currentFieldValues: { [key: string]: any },
    labelValue: string
  ) => {
    const errors: { [fieldName: string]: string } = {};

    currentContext.forEach((c) => {
      // se le dipendenze non sono soddisfatte, il campo è "nascosto" -> non lo validiamo
      if (!areDependenciesMet(c.dipendenze, currentFieldValues)) return;

      // se nullable === true -> opzionale
      if (c.nullable === true) return;

      let value: any = c.user_value;

      // caso speciale idLabel + label personalizzata
      if (c.nome_field === "idLabel" && currentFieldValues["idLabel"] === "lblpers") {
        value = labelValue;
      }

      const hasValue =
        value !== undefined &&
        value !== null &&
        !(
          typeof value === "string" &&
          value.trim() === ""
        ) &&
        !(Array.isArray(value) && value.length === 0);

      if (!hasValue) {
        errors[c.nome_field] = "Questo campo è obbligatorio";
      } else if (
        c.nome_field === "idLabel" &&
        currentFieldValues["idLabel"] === "lblpers" &&
        typeof value === "string" &&
        value.length > MAX_CHAR_CUSTOM_LABEL
      ) {
        errors[c.nome_field] = `La label personalizzata non può superare ${MAX_CHAR_CUSTOM_LABEL} caratteri`;
      }
    });

    return errors;
  };

  // Validazione contesto condiviso
  const validateSharedContext = (): boolean => {
    const errors = erroriContesto(contextLavorazione, fieldValues, customLabelValue);
    setContextErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validazione contesto per-file
  const validateFileContexts = (): boolean => {
    const allErrors: {
      [fileIndex: number]: { [fieldName: string]: string };
    } = {};

    fileContexts.forEach((fc, idx) => {
      const errorsForFile: { [fieldName: string]: string } = {};

      fc.context.forEach((c) => {
        // dipendenze non soddisfatte -> campo nascosto, non si valida
        if (!areDependenciesMet(c.dipendenze, fc.fieldValues)) return;

        // nullable === true -> opzionale
        if (c.nullable === true) return;

        let value: any = c.user_value;

        // caso speciale idLabel + label personalizzata
        if (c.nome_field === "idLabel" && fc.fieldValues["idLabel"] === "lblpers") {
          value = fc.customLabelValue;
        }

        const hasValue =
          value !== undefined &&
          value !== null &&
          !(
            typeof value === "string" &&
            value.trim() === ""
          ) &&
          !(Array.isArray(value) && value.length === 0);

        if (!hasValue) {
          errorsForFile[c.nome_field] = "Questo campo è obbligatorio";
        } else if (
          c.nome_field === "idLabel" &&
          fc.fieldValues["idLabel"] === "lblpers" &&
          typeof value === "string" &&
          value.length > MAX_CHAR_CUSTOM_LABEL
        ) {
          errorsForFile[c.nome_field] = `La label personalizzata non può superare ${MAX_CHAR_CUSTOM_LABEL} caratteri`;
        }
      });

      if (Object.keys(errorsForFile).length > 0) {
        allErrors[idx] = errorsForFile;
      }
    });

    setFileContextErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  };

  const handleUploadFile = async () => {
    if (files.length > 0) {
      const isValid = useSharedContext
        ? validateSharedContext()
        : validateFileContexts();

      if (!isValid) {
        showNotification(
          <div className="flex flex-row items-center">
            <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
            <div className="ml-4 mr-4">
              <div className="font-bold">Compila i campi obbligatori</div>
              <div className="mt-1 text-slate-500 text-sm">
                Alcuni campi contrassegnati come obbligatori non sono stati compilati.
              </div>
            </div>
          </div>
        );
        return;
      }

      setIsUploading(true);
      await handleUploadTracciato.mutateAsync(files);
    }
  };

  const handleEditStart = () => {
    if (!currentPromoData) return;

    setEditFormData({
      id: currentPromoData.id,
      nome: currentPromoData.nome,
      validita_dal: currentPromoData.validita_dal.toString(),
      validita_al: currentPromoData.validita_al.toString(),
      data_scadenza: currentPromoData.data_scadenza,
      offset_visibilita: currentPromoData.offset_visibilita,
      stato: currentPromoData.stato,
      gdo: currentPromoData.gdo,
      meta: currentPromoData.meta ?? {},
    });

    const fieldDefs = dataContestoPerNuovaLavorazione;
    const savedContext = currentPromoData.context as any[];
    if (fieldDefs && fieldDefs.length > 0) {
      const initContext = fieldDefs.map((fieldDef: any) => {
        const saved = Array.isArray(savedContext)
          ? savedContext.find((sc: any) => sc.nome_field === fieldDef.nome_field)
          : null;
        return {
          ...fieldDef,
          user_value: saved?.user_value ?? "",
        };
      });
      const initFieldValues: { [key: string]: any } = {};
      initContext.forEach((item: any) => {
        if (item.user_value) {
          initFieldValues[item.nome_field] = item.user_value;
        }
      });
      setEditContextLavorazione(initContext);
      setEditFieldValues(initFieldValues);
    } else {
      setEditContextLavorazione([]);
      setEditFieldValues({});
    }
    setEditCustomLabelValue("");
    setEditContextErrors({});
    setEditFieldErrors({});

    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditFormData({} as UpdatePromoDTO & { id: string });
    setEditContextLavorazione([]);
    setEditFieldValues({});
    setEditCustomLabelValue("");
    setEditContextErrors({});
    setEditFieldErrors({});
  };

  const handleEditContextChange = (fieldName: string, value: any) => {
    setEditFieldValues((prev) => {
      const next = { ...prev, [fieldName]: value };
      setEditContextLavorazione((prevCtx) =>
        prevCtx
          .map((c) => (c.nome_field === fieldName ? { ...c, user_value: value } : c))
          .map((c) => {
            if (!areDependenciesMet(c.dipendenze || [], next) && c.user_value) {
              return { ...c, user_value: null };
            }
            return c;
          })
      );
      return next;
    });
    setEditContextErrors((prev) => {
      if (!prev[fieldName]) return prev;
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
  };

  const validateEditForm = (): { [field: string]: string } => {
    const errors: { [field: string]: string } = {};

    if (!editFormData.id) {
      errors.id = "L'ID della lavorazione è obbligatorio";
    }

    if (!editFormData.nome || editFormData.nome.trim() === "") {
      errors.nome = "Il nome della lavorazione è obbligatorio";
    }

    if (editFormData.validita_dal && editFormData.validita_al) {
      const dataInizio = dayjs(editFormData.validita_dal);
      const dataFine = dayjs(editFormData.validita_al);

      if (dataInizio.isAfter(dataFine)) {
        errors.validita_al = "La data di inizio deve essere precedente alla data di fine";
      }
    }

    if (editFormData.validita_dal && editFormData.data_scadenza) {
      const dataInizio = dayjs(editFormData.validita_dal);
      const dataScadenza = dayjs(editFormData.data_scadenza);

      if (dataScadenza.isAfter(dataInizio)) {
        errors.data_scadenza = "La data di scadenza non può essere successiva alla data di inizio";
      }
    }

    if (
      editFormData.offset_visibilita !== undefined &&
      editFormData.offset_visibilita < 0
    ) {
      errors.offset_visibilita = "L'offset di visibilità deve essere un numero positivo";
    }

    return errors;
  };

  const handleEditSave = async () => {
    const fieldErrors = validateEditForm();
    const contestoErrors = erroriContesto(editContextLavorazione, editFieldValues, editCustomLabelValue);
    setEditFieldErrors(fieldErrors);
    setEditContextErrors(contestoErrors);
    const validationErrors = Object.values(fieldErrors);
    if (Object.keys(contestoErrors).length > 0) {
      validationErrors.push("Correggi i campi evidenziati nelle specifiche di lavorazione");
    }

    if (validationErrors.length > 0) {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleAlert" className="text-danger w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Errori di validazione</div>
            <ul className="mt-1 text-sm text-slate-600">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      );
      return;
    }

    try {
      if (!currentPromoData?.id) {
        throw new Error("L'ID della lavorazione è obbligatorio");
      }
      const contextForSave =
        editContextLavorazione.length > 0
          ? buildContextForUpload(editContextLavorazione, editFieldValues, editCustomLabelValue)
            .map((item) => ({
              ...item,
              dipendenze: item.dipendenze ?? [],
              nullable: item.nullable ?? false,
            }))
          : undefined;
      await updatePromoMutation.mutateAsync({
        ...editFormData,
        id: currentPromoData.id,
        ...(contextForSave !== undefined && { context: contextForSave as any }), // Cast to any to satisfy type
      });
    } catch (error) {
      console.error("Errore durante il salvataggio:", error);
    }
  };

  const handleEditFieldChange = (field: keyof UpdatePromoDTO, value: any) => {
    setEditFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setEditFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const erroreCampo = (field: string) =>
    editFieldErrors[field] ? <p className="text-xs text-danger">{editFieldErrors[field]}</p> : null;

  const formatDate = formatDataOraEstesa;

  const isEndDateNear = (endDate: string | Date | undefined) => {
    if (!endDate) return false;
    const today = dayjs().startOf("day");
    const end = dayjs(endDate, "DD/MM/YYYY").startOf("day");
    const daysUntilEnd = end.diff(today, "days");
    return daysUntilEnd <= 7 && daysUntilEnd >= 0;
  };

  const getDaysUntilEnd = (endDate: string | Date | undefined) => {
    if (!endDate) return 0;
    const today = dayjs();
    const end = dayjs(endDate, "DD/MM/YYYY");
    return end.diff(today, "days");
  };

  // Accesso alla gestione dei kit, mostrato quando i dati delle lavorazioni sono arrivati
  const renderQuickActions = () => {
    const intestazione = {
      icona: "Package",
      titolo: "Gestione kit",
      descrizione: "Accedi alla pagina di gestione dei kit per questa lavorazione.",
    };
    return (
      <Suspense
        fallback={
          <Sezione {...intestazione} className="h-full">
            <Skeleton className="h-9 w-full rounded-control" />
          </Sezione>
        }
      >
        <Await
          resolve={lavorazioni}
          errorElement={
            <Sezione {...intestazione} className="h-full">
              <ErroreAsync>
                {(messaggio) => (
                  <PageError
                    compatta
                    titolo="Lavorazioni non caricate"
                    motivo={messaggio || "Non è stato possibile recuperare i dati delle lavorazioni"}
                    onRiprova={() => refreshContent()}
                  />
                )}
              </ErroreAsync>
            </Sezione>
          }
        >
          {() => (
            <Sezione {...intestazione} className="h-full">
              <Button
                variant="outline-secondary"
                className="w-full"
                onClick={() => navigate(`/promozioni/in-corso/dettagli/${idPromo}/kits`)}
              >
                Vai ai kit
                <Lucide icon="ArrowRight" aria-hidden="true" className="ml-2 h-4 w-4" />
              </Button>
            </Sezione>
          )}
        </Await>
      </Suspense>
    );
  };

  const renderUploadForm = () => {
    if (hasPermission("file.upload_tracciato")) {
      if (isExpired) {
        return (
          <Alert variant="soft-danger" icona="CalendarX" titolo="Lavorazione scaduta" className="mb-4">
            Questa lavorazione è scaduta il {formatData(currentPromoData?.data_scadenza)}. Non è più possibile caricare nuovi tracciati.
          </Alert>
        );
      }

      return (
        <div className="mb-4 rounded-card border border-slate-200 bg-white p-4">
          <h3 className="title-card mb-3 flex items-center gap-2">
            <Lucide icon="Upload" aria-hidden="true" className="h-4 w-4 text-slate-500" />
            Carica nuovo tracciato
          </h3>

          <div className="space-y-3">
            {files.length === 0 ? (
              <Dropzone
                options={{
                  dragend: (event) => console.log("Drag end", event),
                  dragenter: (event) => console.log("Drag enter", event),
                  // I tipi di dropzone dichiarano addedfiles() senza argomenti, ma l'evento passa i file aggiunti
                  addedfiles: (dzFiles?: ArrayLike<File>) => {
                    const addedFiles = Array.from(dzFiles ?? []);
                    handleAddFile(addedFiles);

                    // Svuoto la coda interna di Dropzone, se esiste il metodo
                    if (
                      refDropzone.current &&
                      typeof refDropzone.current.removeAllFiles === "function"
                    ) {
                      refDropzone.current.removeAllFiles(true);
                    } else if (
                      refDropzone.current &&
                      refDropzone.current.dropzone &&
                      typeof refDropzone.current.dropzone.removeAllFiles ===
                      "function"
                    ) {
                      refDropzone.current.dropzone.removeAllFiles(true);
                    }
                  },
                  method: "POST",
                  url: "uploadTracciati",
                  acceptedFiles: ".xlsx, .xls",
                  previewsContainer: false,
                  autoProcessQueue: false,
                  addRemoveLinks: false,
                  uploadMultiple: true,
                }}
                className="dropzone rounded-card border-2 border-dashed border-slate-300 p-4 text-center transition-colors hover:border-theme-1/50"
                getRef={(el: any) => {
                  if (el && el.dropzone) {
                    refDropzone.current = el.dropzone;
                  } else {
                    refDropzone.current = el;
                  }
                }}
              >
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-control bg-slate-100">
                      <Lucide icon="Upload" aria-hidden="true" className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-700">
                      Trascina il file qui o fai clic
                    </div>
                    <div className="text-xs text-slate-500">File .xlsx e .xls</div>
                  </div>
                </div>
              </Dropzone>
            ) : null}

            {files.length > 0 && (
              <div className="rounded-control border border-slate-200 p-3">
                {/* Lista file selezionati */}
                <div className="space-y-2 mb-3">
                  {files.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-control bg-slate-50 px-2 py-1 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Lucide
                          icon="FileText"
                          className="w-3 h-3 text-primary flex-shrink-0"
                        />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline-danger"
                        size="xs"
                        onClick={() => handleRemoveSingleFile(idx)}
                        title="Rimuovi questo file"
                        aria-label={`Rimuovi ${f.name}`}
                      >
                        <Lucide icon="Trash2" aria-hidden="true" className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex justify-between items-center mt-2">
                    <span className="text-2xs text-slate-400">
                      {files.length} file selezionat
                      {files.length !== 1 ? "i" : "o"}.
                    </span>
                    <Button
                      variant="outline-danger"
                      size="xs"
                      onClick={handleRemoveFile}
                    >
                      <Lucide icon="Trash2" aria-hidden="true" className="mr-1 h-3 w-3" />
                      Rimuovi tutti
                    </Button>
                  </div>
                </div>

                {/* Stato caricamento o configurazione contesto */}
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-sm text-slate-500">
                    <Spinner size="md" etichetta="Caricamento dei tracciati" />
                    <p aria-hidden="true">Caricamento…</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Suspense fallback={<Skeleton className="w-full h-32" />}>
                      {contextLavorazioneQuery.isLoading ? (
                        <div className="rounded-control border border-slate-200 bg-slate-50 p-3">
                          <h4 className="title-eyebrow mb-3">Configurazione</h4>
                          <div className="space-y-3">
                            <Skeleton className="w-full h-8" />
                            <Skeleton className="w-full h-8" />
                            <Skeleton className="w-full h-8" />
                          </div>
                        </div>
                      ) : contextLavorazioneQuery.isError ? (
                        <PageError
                          compatta
                          titolo="Contesto di lavorazione non caricato"
                          motivo={contextLavorazioneQuery.error?.message || "Si è verificato un errore durante il caricamento del contesto"}
                          onRiprova={() => contextLavorazioneQuery.refetch()}
                        />
                      ) : (useSharedContext
                        ? contextLavorazione?.length > 0
                        : fileContexts.length > 0) ? (
                        <div className="rounded-control border border-slate-200 bg-slate-50 p-3">
                          {/* Header configurazione + toggle */}
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="title-eyebrow">Configurazione</h4>
                            <div className="flex items-center gap-3 text-xs">

                              <FormCheck className="inline-flex items-center cursor-pointer gap-1">
                                <FormCheck.Label>
                                  Stesso contesto per tutti
                                </FormCheck.Label>
                                <FormCheck.Input
                                  type="checkbox"
                                  checked={useSharedContext}
                                  onChange={(
                                    event: React.FormEvent<HTMLDivElement>
                                  ) => {
                                    const checked = (event.target as HTMLInputElement)
                                      .checked;

                                    if (checked) {
                                      // per-file -> condiviso
                                      const base =
                                        fileContexts[selectedFileIndex] ||
                                        fileContexts[0];
                                      if (base) {
                                        setContextLavorazione(
                                          base.context.map((c) => ({ ...c }))
                                        );
                                        setFieldValues({ ...base.fieldValues });
                                        setCustomLabelValue(base.customLabelValue);
                                      }
                                    } else {
                                      // condiviso -> per-file
                                      if (
                                        contextLavorazioneQuery.data &&
                                        files.length > 0
                                      ) {
                                        setFileContexts(() => {
                                          const ctxShared = contextLavorazione;
                                          const fvShared = fieldValues;
                                          const clShared = customLabelValue;

                                          return files.map(() => ({
                                            context: ctxShared.map((c) => ({ ...c })),
                                            fieldValues: { ...fvShared },
                                            customLabelValue: clShared,
                                          }));
                                        });
                                      }
                                    }

                                    setUseSharedContext(checked);
                                    setContextErrors({});
                                    setFileContextErrors({});
                                  }}
                                />
                              </FormCheck>
                            </div>
                          </div>

                          {/* Select file in modalità per-file */}
                          {!useSharedContext && files.length > 0 && (
                            <div className="mb-3">
                              <FormLabel className="text-xs font-medium">
                                Seleziona il file da configurare
                              </FormLabel>
                              <FormSelect
                                value={selectedFileIndex}
                                onChange={(e) =>
                                  setSelectedFileIndex(
                                    parseInt(e.target.value, 10)
                                  )
                                }
                                className="text-xs"
                              >
                                {files.map((f, idx) => (
                                  <option key={idx} value={idx}>
                                    {idx + 1}. {f.name}
                                  </option>
                                ))}
                              </FormSelect>
                            </div>
                          )}

                          {/* Campi di contesto */}
                          {(() => {
                            const currentContext = useSharedContext
                              ? contextLavorazione
                              : fileContexts[selectedFileIndex]?.context || [];

                            const currentFieldValues = useSharedContext
                              ? fieldValues
                              : fileContexts[selectedFileIndex]?.fieldValues || {};

                            const currentCustomLabelValue = useSharedContext
                              ? customLabelValue
                              : fileContexts[selectedFileIndex]?.customLabelValue ||
                              "";

                            const currentErrors = useSharedContext
                              ? contextErrors
                              : fileContextErrors[selectedFileIndex] || {};

                            if (!currentContext || currentContext.length === 0) {
                              return (
                                <p className="text-xs text-slate-500">
                                  Nessun campo di contesto disponibile.
                                </p>
                              );
                            }

                            return (
                              <div className="space-y-3">
                                {currentContext.map((contesto, idx) => {
                                  if (
                                    !areDependenciesMet(
                                      contesto.dipendenze,
                                      currentFieldValues
                                    )
                                  )
                                    return null;

                                  if (contesto.tipo_field === "cmb") {
                                    const errorMessage =
                                      currentErrors[contesto.nome_field];

                                    return (
                                      <div key={idx} className="space-y-1">
                                        <FormLabel
                                          htmlFor={contesto.nome_field}
                                          className="text-sm font-medium"
                                        >
                                          {contesto.titolo_field}
                                        </FormLabel>
                                        <FormSelect
                                          id={contesto.nome_field}
                                          value={
                                            currentFieldValues[
                                            contesto.nome_field
                                            ] || ""
                                          }
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            handleInputChange(
                                              contesto.nome_field,
                                              value
                                            );

                                            if (
                                              contesto.nome_field === "idLabel" &&
                                              value !== "lblpers"
                                            ) {
                                              if (useSharedContext) {
                                                setCustomLabelValue("");
                                              } else {
                                                setFileContexts((prev) =>
                                                  prev.map((fc, idxFc) =>
                                                    idxFc === selectedFileIndex
                                                      ? {
                                                        ...fc,
                                                        customLabelValue: "",
                                                      }
                                                      : fc
                                                  )
                                                );
                                              }
                                            }
                                          }}
                                          className="w-full text-sm"
                                        >
                                          <option value="">
                                            {contesto.titolo_field}
                                          </option>
                                          {contesto.valore.map(
                                            (valore, idxVal) => (
                                              <option
                                                key={idxVal}
                                                value={valore.valore}
                                              >
                                                {valore.titolo}
                                              </option>
                                            )
                                          )}
                                        </FormSelect>

                                        {currentFieldValues[
                                          contesto.nome_field
                                        ] === "lblpers" && (
                                            <>
                                              <FormInput
                                                id={`${contesto.nome_field}_custom`}
                                                placeholder="Inserisci la tua etichetta personalizzata"
                                                value={currentCustomLabelValue}
                                                onChange={(e) => {
                                                  const value = e.target.value;
                                                  if (useSharedContext) {
                                                    setCustomLabelValue(value);
                                                  } else {
                                                    setFileContexts((prev) =>
                                                      prev.map((fc, idxFc) =>
                                                        idxFc === selectedFileIndex
                                                          ? {
                                                            ...fc,
                                                            customLabelValue: value,
                                                          }
                                                          : fc
                                                      )
                                                    );
                                                  }
                                                }}
                                                className="w-full text-sm mt-1"
                                              />
                                              {!errorMessage && currentCustomLabelValue.length > MAX_CHAR_CUSTOM_LABEL && (
                                                <p className="mt-1 text-xs text-danger">
                                                  La label non può superare {MAX_CHAR_CUSTOM_LABEL} caratteri
                                                </p>
                                              )}
                                            </>
                                          )}

                                        {errorMessage && (
                                          <p className="mt-1 text-xs text-danger">
                                            {errorMessage}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (contesto.tipo_field === "radio") {
                                    const errorMessage =
                                      currentErrors[contesto.nome_field];

                                    return (
                                      <div key={idx} className="space-y-2">
                                        <FormLabel className="text-sm font-medium">
                                          {contesto.titolo_field}
                                        </FormLabel>
                                        <div className="space-y-1">
                                          {contesto.valore.map(
                                            (valore, idxVal) => (
                                              <label
                                                key={idxVal}
                                                className="flex items-center space-x-2 cursor-pointer text-sm"
                                              >
                                                <input
                                                  type="radio"
                                                  id={valore.valore}
                                                  name={contesto.nome_field}
                                                  value={valore.valore}
                                                  checked={
                                                    currentContext.find(
                                                      (c) =>
                                                        c.nome_field ===
                                                        contesto.nome_field
                                                    )?.user_value ===
                                                    valore.valore
                                                  }
                                                  onChange={(e) =>
                                                    handleInputChange(
                                                      contesto.nome_field,
                                                      e.target.value
                                                    )
                                                  }
                                                  className="text-primary"
                                                />
                                                <span>{valore.titolo}</span>
                                              </label>
                                            )
                                          )}
                                        </div>

                                        {errorMessage && (
                                          <p className="mt-1 text-xs text-danger">
                                            {errorMessage}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }

                                  if (contesto.tipo_field === "text") {
                                    const errorMessage =
                                      currentErrors[contesto.nome_field];

                                    return (
                                      <div key={idx} className="space-y-1">
                                        <FormLabel
                                          htmlFor={contesto.nome_field}
                                          className="text-sm font-medium"
                                        >
                                          {contesto.titolo_field}
                                        </FormLabel>
                                        <FormInput
                                          id={contesto.nome_field}
                                          value={
                                            currentContext.find(
                                              (c) =>
                                                c.nome_field ===
                                                contesto.nome_field
                                            )?.user_value || ""
                                          }
                                          onChange={(e) =>
                                            handleInputChange(
                                              contesto.nome_field,
                                              e.target.value
                                            )
                                          }
                                          className="w-full text-sm"
                                        />

                                        {errorMessage && (
                                          <p className="mt-1 text-xs text-danger">
                                            {errorMessage}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  if (contesto.tipo_field === "check") {
                                    const errorMessage =
                                      currentErrors[contesto.nome_field];
                                    const currentValue =
                                      currentContext.find(
                                        (c) =>
                                          c.nome_field ===
                                          contesto.nome_field
                                      )?.user_value || "";
                                    const currentValues = currentValue
                                      .split(",")
                                      .filter(Boolean);

                                    return (
                                      <div key={idx} className="space-y-2">
                                        <FormLabel className="text-sm font-medium">
                                          {contesto.titolo_field}
                                        </FormLabel>
                                        <div className="flex flex-col gap-2">
                                          {contesto.valore.map(
                                            (valore: any, idxVal: number) => {
                                              const isChecked =
                                                currentValues.includes(
                                                  valore.valore
                                                );

                                              return (
                                                <FormCheck
                                                  key={idxVal}
                                                  className="inline-flex items-center cursor-pointer gap-2"
                                                >
                                                  <FormCheck.Input
                                                    type="checkbox"
                                                    id={`${contesto.nome_field}-${valore.valore}`}
                                                    checked={isChecked}
                                                    onChange={() => {
                                                      const updated = isChecked
                                                        ? currentValues.filter(
                                                          (v: string) =>
                                                            v !==
                                                            valore.valore
                                                        )
                                                        : [
                                                          ...currentValues,
                                                          valore.valore,
                                                        ];
                                                      handleInputChange(
                                                        contesto.nome_field,
                                                        updated.join(",")
                                                      );
                                                    }}
                                                    className="text-primary"
                                                  />
                                                  <FormCheck.Label
                                                    htmlFor={`${contesto.nome_field}-${valore.valore}`}
                                                    className="text-sm"
                                                  >
                                                    {valore.titolo}
                                                  </FormCheck.Label>
                                                </FormCheck>
                                              );
                                            }
                                          )}
                                        </div>

                                        {errorMessage && (
                                          <p className="mt-1 text-xs text-danger">
                                            {errorMessage}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </Suspense>

                    {/* Bottoni azione */}
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleRemoveFile}
                      >
                        Annulla
                      </Button>
                      <Button
                        onClick={handleUploadFile}
                        disabled={isUploading || !files || files.length === 0}
                        variant="primary"
                        size="sm"
                      >
                        <Lucide icon="Upload" className="w-3 h-3 mr-1" />
                        Carica
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    } else {
      return null
    }
  };

  const renderTracciatiContent = () => {
    return (
      <Suspense
        fallback={
          <div className="space-y-3">
            {
              (!isExpired || lavorazioni == undefined) && (
                <div className="rounded-card border border-slate-200 bg-white p-4">
                  <div className="flex items-center mb-3">
                    <Skeleton className="mr-2 h-8 w-8 rounded-control" />
                    <div className="flex-1">
                      <Skeleton className="w-48 h-5 mb-1" />
                      <Skeleton className="w-36 h-3" />
                    </div>
                  </div>
                  <div className="rounded-card border-2 border-dashed border-slate-300 p-6">
                    <div className="space-y-2 text-center">
                      <div className="flex justify-center">
                        <Skeleton className="h-8 w-8 rounded-control" />
                      </div>
                      <div className="space-y-1">
                        <Skeleton className="w-56 h-4 mx-auto" />
                        <Skeleton className="w-40 h-3 mx-auto" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }

            {/* Skeleton TracciatoCard list */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-card border border-slate-200 p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Skeleton className="w-6 h-6 rounded-full" />
                      <Skeleton className="w-48 h-4" />
                    </div>
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-24 h-3" />
                      <Skeleton className="w-24 h-3" />
                      <Skeleton className="w-20 h-3" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <Skeleton className="w-8 h-8" />
                    <Skeleton className="w-8 h-8" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Skeleton className="w-24 h-5 rounded-full" />
                  <Skeleton className="w-32 h-3" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        {tracciatiQuery.isError ? (
          <PageError
            compatta
            titolo="Tracciati non caricati"
            motivo={tracciatiQuery.error?.message || "Si è verificato un errore durante il recupero dei tracciati"}
            onRiprova={refreshContent}
          />
        ) : (
          (() => {
            const tracciati = tracciatiQuery.data ?? [];
            if (tracciati.length === 0) {
              return (
                <>
                  {renderUploadForm()}
                  {!isExpired && (
                    <EmptyState
                      compatta
                      title="Nessun tracciato caricato"
                      description="Carica il primo tracciato per iniziare le lavorazioni"
                      icon="FileText"
                    />
                  )}
                </>
              );
            }

            return (
              <div>
                {renderUploadForm()}
                <div className="max-h-96 space-y-3 overflow-y-scroll">
                  {ordinaTracciati(tracciati, ordineTracciati).map((tracciato: TracciatiResponseDTO) => (
                    <TracciatoCard
                      key={tracciato.id}
                      tracciato={tracciato}
                      getFileSize={getFileSize}
                      handleDownload={handleDownload}
                      expandedErrorTracciatoId={expandedErrorTracciatoId}
                      setExpandedErrorTracciatoId={setExpandedErrorTracciatoId}
                      formatDate={formatDate}
                      getShortError={getShortError}
                      onDeleteTracciato={handleDeleteTracciato}
                      isDeletingTracciato={
                        deleteTracciatoMutation.isPending &&
                        deleteTracciatoMutation.variables === String(tracciato.id)
                      }
                      promoStorico={isPromoFinalState(currentPromoData?.stato)}
                    />
                  ))}
                </div>
              </div>
            );
          })()
        )}
      </Suspense>
    );
  };

  const renderLavorazioneDetails = () => {
    if (!currentPromoData) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ))}
        </div>
      );
    }

    if (isEditing) {
      return renderEditForm();
    }

    const dati = [
      { etichetta: "Nome promozione", valore: currentPromoData.nome },
      { etichetta: "Offset visibilità", valore: `${currentPromoData.offset_visibilita} giorni` },
      { etichetta: "Data inizio", valore: formatData(currentPromoData.validita_dal) },
      { etichetta: "Data fine", valore: formatData(currentPromoData.validita_al) },
      { etichetta: "Data scadenza", valore: formatData(currentPromoData.data_scadenza) },
    ];

    return (
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {dati.map((dato) => (
          <div key={dato.etichetta}>
            <dt className="title-eyebrow">{dato.etichetta}</dt>
            <dd className="mt-1 break-words font-semibold tabular-nums text-slate-800">{dato.valore}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const renderEditForm = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <FormLabel
              htmlFor="nome"
              className="text-sm font-medium text-slate-600"
            >
              Nome Promozione <span className="text-danger">*</span>
            </FormLabel>
            <FormInput
              id="nome"
              value={editFormData.nome || ""}
              onChange={(e) => handleEditFieldChange("nome", e.target.value)}
              className={clsx("w-full", editFieldErrors.nome && "border-danger")}
              placeholder="Inserisci il nome della lavorazione"
              required
            />
            {erroreCampo("nome")}
          </div>

          <div className="space-y-2">
            <FormLabel
              htmlFor="offset_visibilita"
              className="text-sm font-medium text-slate-600"
            >
              Offset Visibilità
            </FormLabel>
            <FormInput
              id="offset_visibilita"
              type="number"
              min="0"
              value={editFormData.offset_visibilita || ""}
              onChange={(e) =>
                handleEditFieldChange(
                  "offset_visibilita",
                  parseInt(e.target.value) || 0
                )
              }
              className={clsx("w-full", editFieldErrors.offset_visibilita && "border-danger")}
              placeholder="Offset visibilità"
            />
            {erroreCampo("offset_visibilita")}
            <p className="text-xs text-slate-500">
              Numero di giorni di anticipo per la visibilità
            </p>
          </div>

          <div className="space-y-2">
            <FormLabel
              htmlFor="validita_dal"
              className="text-sm font-medium text-slate-600"
            >
              Data Inizio
            </FormLabel>
            <FormInput
              id="validita_dal"
              type="date"
              value={
                editFormData.validita_dal
                  ? dayjs(editFormData.validita_dal).format("YYYY-MM-DD")
                  : ""
              }
              onChange={(e) =>
                handleEditFieldChange(
                  "validita_dal",
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
              className={clsx("w-full", editFieldErrors.validita_dal && "border-danger")}
            />
            {erroreCampo("validita_dal")}
            <p className="text-xs text-slate-500">
              Data di inizio della promozione
            </p>
          </div>

          <div className="space-y-2">
            <FormLabel
              htmlFor="validita_al"
              className="text-sm font-medium text-slate-600"
            >
              Data Fine
            </FormLabel>
            <FormInput
              id="validita_al"
              type="date"
              value={
                editFormData.validita_al
                  ? dayjs(editFormData.validita_al).format("YYYY-MM-DD")
                  : ""
              }
              onChange={(e) =>
                handleEditFieldChange(
                  "validita_al",
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
              className={clsx("w-full", editFieldErrors.validita_al && "border-danger")}
            />
            {erroreCampo("validita_al")}
            <p className="text-xs text-slate-500">
              Data di fine della promozione
            </p>
          </div>

          <div className="space-y-2">
            <FormLabel
              htmlFor="data_scadenza"
              className="text-sm font-medium text-slate-600"
            >
              Data Scadenza
            </FormLabel>
            <FormInput
              id="data_scadenza"
              type="date"
              value={
                editFormData.data_scadenza
                  ? dayjs(editFormData.data_scadenza).format("YYYY-MM-DD")
                  : ""
              }
              onChange={(e) =>
                handleEditFieldChange(
                  "data_scadenza",
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
              className={clsx("w-full", editFieldErrors.data_scadenza && "border-danger")}
            />
            {erroreCampo("data_scadenza")}
            <p className="text-xs text-slate-500">
              Data di scadenza per la lavorazione
            </p>
          </div>
        </div>

        {/* Sezione contesto modificabile */}
        {(isLoadingContestoPerNuovaLavorazione || editContextLavorazione.length > 0) && (
          <SpecificheLavorazione caricamento={isLoadingContestoPerNuovaLavorazione}>
            <ContestoLavorazioneFields
              context={editContextLavorazione}
              fieldValues={editFieldValues}
              customLabelValue={editCustomLabelValue}
              errors={editContextErrors}
              maxCharCustomLabel={MAX_CHAR_CUSTOM_LABEL}
              onChange={handleEditContextChange}
              onCustomLabelChange={setEditCustomLabelValue}
              idPrefix="edit_"
            />
          </SpecificheLavorazione>
        )}

        <VisibilitaPromoFields
          value={editFormData.meta?.visibilita}
          onChange={(visibilita) => handleEditFieldChange("meta", { ...editFormData.meta, visibilita })}
        />

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={handleEditCancel}
            disabled={updatePromoMutation.isPending}
          >
            <Lucide icon="X" className="w-4 h-4 mr-2" />
            Annulla
          </Button>
          <PermissionGate permission="promo.modifica">
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditSave}
              loading={updatePromoMutation.isPending}
            >
              {!updatePromoMutation.isPending && <Lucide icon="Save" aria-hidden="true" className="w-4 h-4 mr-2" />}
              Salva Modifiche
            </Button>
          </PermissionGate>
        </div>
      </div>
    );
  };

  const promoFinale = isPromoFinalState(currentPromoData?.stato);
  // Legenda del grafico: stesso ordine e colori delle fette
  const legendaStati = (lavorazioniResolved: any[] | null) => [
    {
      etichetta: "In lavorazione",
      punto: "bg-primary/60",
      variante: "primary" as const,
      numero: lavorazioniResolved?.filter((l: any) => l.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE).length ?? 0,
    },
    {
      etichetta: "Completate",
      punto: "bg-success/60",
      variante: "success" as const,
      numero: lavorazioniResolved?.filter((l: any) => l.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO).length ?? 0,
    },
    {
      etichetta: "In revisione",
      punto: "bg-warning/60",
      variante: "warning" as const,
      numero: lavorazioniResolved?.filter((l: any) => l.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE).length ?? 0,
    },
    {
      etichetta: "In attesa di partenza",
      punto: "bg-danger/60",
      variante: "error" as const,
      numero: lavorazioniResolved?.filter((l: any) => l.isDesignKit === true).length ?? 0,
    },
  ];

  return (
    <Pagina
      titolo="Dettagli promozione"
      indietro={{
        // Prima che la promo arrivi decide l'indirizzo: la pagina serve sia le promo in corso sia lo storico
        to: (currentPromoData ? isPromoFinalState(currentPromoData.stato) : location.pathname.startsWith("/promozioni/storico"))
          ? "/promozioni/storico"
          : "/promozioni/in-corso",
      }}
      badges={currentPromoData && <StatusBadge dominio="promo" stato={currentPromoData.stato} />}
      descrizione={
        currentPromoData ? (
          <>
            {currentPromoData.nome} · creata il {formatDate(currentPromoData.data_registrazione)}
          </>
        ) : (
          "Caricamento…"
        )
      }
    >
      {currentPromoData && isEndDateNear(currentPromoData.validita_al) && !isExpired && (
        <Alert
          variant="soft-warning"
          icona="Clock"
          titolo={
            <span className="flex flex-wrap items-center gap-2">
              Scadenza imminente
              <Badge variant="warning" size="sm">
                {getDaysUntilEnd(currentPromoData.validita_al)} giorni rimasti
              </Badge>
            </span>
          }
        >
          La lavorazione scadrà il <strong>{formatData(currentPromoData.validita_al)}</strong>. Assicurati di completare
          tutte le attività prima della scadenza.
        </Alert>
      )}

      <Sezione
        icona="Info"
        titolo="Informazioni promozione"
        descrizione="Dettagli e configurazione della promozione corrente"
        azioni={
          !isEditing &&
          currentPromoData &&
          currentPromoData.stato !== STATO_PROMO.ELIMINATA &&
          !promoFinale && (
            <Button variant="outline-secondary" size="sm" onClick={handleEditStart}>
              <Lucide icon="Pencil" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
              Modifica
            </Button>
          )
        }
      >
        {renderLavorazioneDetails()}
      </Sezione>

      {showMenabo && (
        <SezioneCollegamento
          icona="Grid3x3"
          titolo="Menabò"
          descrizione="Gestisci il menabò dei volantini, pronto per la visualizzazione e il download."
          azione={
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => navigate(`/promozioni/${promoFinale ? "storico" : "in-corso"}/dettagli/${idPromo}/menabo`)}
            >
              Vai al menabò
              <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          }
        />
      )}

      <Sezione icona="BookOpen" titolo="Volantini della promozione" descrizione="File volantini pronti per download e visualizzazione">
        <React.Suspense fallback={<VolantiniSkeleton />}>
          <Await
            resolve={volantini}
            errorElement={
              <ErroreAsync>
                {(messaggio) => (
                  <PageError
                    compatta
                    titolo="Volantini non caricati"
                    motivo={messaggio || "Non è stato possibile caricare i volantini"}
                    onRiprova={() => refreshContent()}
                  />
                )}
              </ErroreAsync>
            }
          >
            {(volantiniResolved: VolantinoKit[] | null) => {
              if (!volantiniResolved || volantiniResolved.length === 0) {
                return (
                  <EmptyState
                    compatta
                    icon="FolderOpen"
                    title="Nessun volantino disponibile"
                    description="Non ci sono file volantini pronti per questa promozione"
                  />
                );
              }

              return (
                <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
                  {volantiniResolved.map((kit: VolantinoKit) => {
                    const file = kit.files?.[0];
                    return (
                      <CardVolantino
                        key={kit.guidId}
                        titolo={kit.titolo}
                        stato={kit.stato_lavorazione}
                        nomeArea={kit.nomeArea}
                        nomeCanale={kit.nomeCanale}
                        file={
                          file && {
                            nome: file.nome,
                            anteprima: file.url,
                            idOlimpoCloud: file.id_olimpo_cloud,
                            tipoExport: file.tipo_export_codice,
                            mime: file.mime,
                            pagine: file.pages,
                          }
                        }
                        validitaDal={currentPromoData?.validita_dal}
                        validitaAl={currentPromoData?.validita_al}
                        collegamento={`/promozioni/${promoFinale ? "storico" : "in-corso"}/dettagli/${idPromo}/kits/${kit.guidId}`}
                      />
                    );
                  })}
                </div>
              );
            }}
          </Await>
        </React.Suspense>
      </Sezione>

      {idPromo && promoFinale && (
        <SezioneCollegamento
          icona="FolderOpen"
          titolo="Materiali promozione"
          descrizione="Visualizza i materiali per questa promozione"
          azione={
            <Button variant="outline-secondary" size="sm" onClick={() => navigate(`/promozioni/storico/dettagli/${idPromo}/materiali`)}>
              Visualizza materiali
              <Lucide icon="ArrowRight" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-12 gap-6">
        {!promoFinale && <div className="col-span-12 lg:col-span-4">{renderQuickActions()}</div>}

        <Sezione
          icona="ChartPie"
          titolo="Stato lavorazioni"
          descrizione="Panoramica dello stato delle lavorazioni"
          className={clsx("col-span-12", !promoFinale && "lg:col-span-8")}
        >
          <React.Suspense
            fallback={
              <div className="flex flex-col items-center justify-center lg:flex-row">
                <div className="flex w-full justify-center lg:w-1/2">
                  <Skeleton className="h-48 w-48 rounded-full" />
                </div>
                <div className="mt-4 w-full space-y-3 lg:mt-0 lg:w-1/2 lg:pl-6">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            }
          >
            <Await
              resolve={Promise.all([datoGraficoPaginaLavorazioni, lavorazioni])}
              errorElement={
                <ErroreAsync>
                  {(messaggio) => (
                    <PageError
                      compatta
                      titolo="Grafico non caricato"
                      motivo={messaggio || "Impossibile caricare i dati del grafico."}
                      onRiprova={() => refreshContent()}
                    />
                  )}
                </ErroreAsync>
              }
            >
              {([datoGrafico, lavorazioniResolved]: [any, any[] | null]) => (
                <div className="flex flex-col items-center justify-center lg:flex-row">
                  <div className="flex w-full justify-center lg:w-1/2">
                    <LazyChart
                      height={220}
                      type="doughnut"
                      data={datoGrafico}
                      options={{
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                        // @ts-ignore
                        cutout: "75%",
                      }}
                    />
                  </div>

                  <ul className="mt-4 w-full space-y-2 lg:mt-0 lg:w-1/2 lg:pl-6">
                    {legendaStati(lavorazioniResolved).map((voce) => (
                      <li
                        key={voce.etichetta}
                        className="flex items-center justify-between rounded-control border border-slate-100 px-3 py-2"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          <span aria-hidden="true" className={clsx("h-3 w-3 rounded-full", voce.punto)} />
                          {voce.etichetta}
                        </span>
                        <Badge variant={voce.variante} size="sm">
                          {voce.numero}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Await>
          </React.Suspense>
        </Sezione>
      </div>

      <Sezione
        icona="Files"
        titolo="Tracciati caricati"
        descrizione={(() => {
          const count = tracciatiQuery.data?.length || 0;
          if (tracciatiQuery.isLoading) return "Caricamento…";
          if (count === 0) return "Nessun tracciato disponibile";
          return `${count} tracciat${count !== 1 ? "i" : "o"} disponibil${count !== 1 ? "i" : "e"}`;
        })()}
        azioni={
          (tracciatiQuery.data?.length ?? 0) > 1 && (
            <FormSelect
              formSelectSize="sm"
              className="w-auto"
              aria-label="Ordina i tracciati"
              value={ordineTracciati}
              onChange={(e) => setOrdineTracciati(e.target.value as OrdineTracciati)}
            >
              {ORDINI_TRACCIATI.map((o) => (
                <option key={o.valore} value={o.valore}>
                  {o.etichetta}
                </option>
              ))}
            </FormSelect>
          )
        }
      >
        {renderTracciatiContent()}
      </Sezione>

      {showMomenti && (
        <Sezione
          icona="Timer"
          titolo="Gestione momenti"
          descrizione="Gestisci i momenti in cui sono state importate le liste per l'analisi successiva dei dati."
        >
          <GestioneMomenti idPromo={idPromo} tracciati={tracciatiQuery.data ?? []} />
        </Sezione>
      )}
    </Pagina>
  );
}

export default withSessionCheckOptimized(Main);
