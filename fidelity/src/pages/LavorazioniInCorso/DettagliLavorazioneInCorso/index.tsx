import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import Dropzone from "@/components/Base/Dropzone";
import { FormCheck, FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import Skeleton from "@/components/Base/Skeleton";
import ContestoLavorazioneFields from "@/components/ContestoLavorazioneFields";
import EmptyState from "@/components/EmptyState";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import { useNotification } from "@/context/NotificationContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import customParseFormat from "dayjs/plugin/customParseFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import React, { Fragment, Suspense, useEffect, useRef, useState } from "react";
import {
  Await,
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
import { useContestoPerNuovaLavorazione } from "../../../query/query";
import GestioneMomenti from "./GestioneMomenti";
import TracciatoCard from "./TracciatoCard";
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.locale("it");

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

// Stili per badge stato
const BADGE_STYLES: Record<string, string> = {
  PUBBLICATO: "bg-success/10 text-success border-success/20",
  IN_LAVORAZIONE: "bg-info/10 text-info border-info/20",
  IN_LAVORAZIONE_CON_ERRORI: "bg-danger/10 text-danger border-danger/20",
  IN_REVISIONE: "bg-warning/10 text-warning border-warning/20",
};

// Componente card per visualizzare un file volantino (stile Dashboard3)
const VolantinoFileCard: React.FC<{
  kit: VolantinoKit;
  idPromo: string;
  onNavigate: (kitId: string) => void;
  validitaDal?: string;
  validitaAl?: string;
}> = ({ kit, idPromo, onNavigate, validitaDal, validitaAl }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const file = kit.files?.[0];
  const previewUrl = file?.url ?? "";
  const hasPreview = Boolean(previewUrl);
  const canDownload = Boolean(file?.id_olimpo_cloud);

  const handleDownload = async () => {
    if (!file?.id_olimpo_cloud || isDownloading) return;
    setIsDownloading(true);
    try {
      const url = ServerCall.getUrl();
      const response = await axios.get(
        `${url}/getFileFromOlimpo?id=${file.id_olimpo_cloud}`,
        { responseType: "arraybuffer" }
      );
      const blob = new Blob([response.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.nome || "volantino.pdf";
      link.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Errore durante il download del file:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const renderStatoBadge = (stato: string) => {
    const normalized = stato?.toUpperCase();
    const badgeClasses = BADGE_STYLES[normalized] ?? "bg-slate-100 text-slate-600 border-slate-200";
    return (
      <span className={clsx("px-2.5 py-0.5 text-[11px] font-semibold rounded-full border", badgeClasses)}>
        {normalized?.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <>
      <div className="relative p-4 rounded-[0.6rem] border border-dashed border-slate-200/70 bg-white/90 backdrop-blur-sm shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
        <div className="flex gap-4">
          {/* Thumbnail Preview */}
          <div className="relative shrink-0">
            {hasPreview ? (
              <button
                type="button"
                className="group/preview w-20 h-24 rounded-[0.6rem] overflow-hidden border border-theme-1/20 bg-slate-50 relative focus-visible:outline focus-visible:outline-theme-1/40"
                onClick={() => setIsPreviewOpen(true)}
              >
                <img
                  src={previewUrl}
                  alt={kit.titolo}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <span className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                  <Lucide icon="Eye" className="w-4 h-4 mr-1" /> Anteprima
                </span>
              </button>
            ) : (
              <div className="w-20 h-24 rounded-[0.6rem] border border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
                <Lucide icon="FileText" className="w-5 h-5 text-slate-400" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button
                  type="button"
                  className="block text-sm font-semibold text-slate-800 truncate hover:text-theme-1 transition-colors text-left"
                  onClick={() => onNavigate(kit.guidId)}
                >
                  {kit.titolo}
                </button>
                {(kit.nomeArea || kit.nomeCanale) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {kit.nomeArea && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        <Lucide icon="MapPin" className="w-2.5 h-2.5" />
                        {kit.nomeArea}
                      </span>
                    )}
                    {kit.nomeCanale && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-theme-1/10 text-theme-1 border border-theme-1/20">
                        <Lucide icon="Store" className="w-2.5 h-2.5" />
                        {kit.nomeCanale}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {renderStatoBadge(kit.stato_lavorazione)}
            </div>

            {/* File info */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-slate-500">
              {(validitaDal || validitaAl) && (
                <span className="inline-flex items-center gap-1 text-theme-1">
                  <Lucide icon="Calendar" className="w-3 h-3" />
                  {validitaDal && validitaAl ? (
                    <>
                      {dayjs(validitaDal).locale("it").format("D MMM")} - {dayjs(validitaAl).locale("it").format("D MMM YYYY")}
                    </>
                  ) : validitaAl ? (
                    <>fino al {dayjs(validitaAl).locale("it").format("D MMM YYYY")}</>
                  ) : validitaDal ? (
                    <>dal {dayjs(validitaDal).locale("it").format("D MMM YYYY")}</>
                  ) : null}
                </span>
              )}
              {file?.tipo_export_codice && (
                <span className="inline-flex items-center gap-1">
                  <Lucide icon="Layers" className="w-3 h-3" />
                  {file.tipo_export_codice}
                </span>
              )}
              {file?.mime && (
                <span className="inline-flex items-center gap-1">
                  <Lucide icon="File" className="w-3 h-3" />
                  {file.mime}
                </span>
              )}
              {file?.pages && file.pages > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Lucide icon="Book" className="w-3 h-3" />
                  {file.pages} pp
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end mt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={clsx(
                    "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border",
                    canDownload && !isDownloading
                      ? "text-success border-success/30 bg-success/10 hover:bg-success/20"
                      : "text-slate-400 border-slate-200 cursor-not-allowed"
                  )}
                  onClick={handleDownload}
                  disabled={!canDownload || isDownloading}
                >
                  <Lucide icon={isDownloading ? "Loader" : "Download"} className={clsx("w-3.5 h-3.5", isDownloading && "animate-spin")} />
                  {isDownloading ? "Download..." : "Scarica"}
                </button>
                <button
                  type="button"
                  className={clsx(
                    "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border",
                    hasPreview
                      ? "text-theme-1 border-theme-1/30 bg-theme-1/10 hover:bg-theme-1/20"
                      : "text-slate-400 border-slate-200 cursor-not-allowed"
                  )}
                  onClick={() => hasPreview && setIsPreviewOpen(true)}
                  disabled={!hasPreview}
                >
                  <Lucide icon="Focus" className="w-3.5 h-3.5" />
                  Anteprima
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && hasPreview && (
        <PreviewImmaginePdf
          imageUrl={previewUrl}
          totalPages={file?.pages ?? 1}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </>
  );
};

// Skeleton per la sezione volantini
const VolantiniSkeleton: React.FC = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="p-4 rounded-[0.6rem] border border-dashed border-slate-200/70 bg-white/80 flex items-center gap-4"
      >
        <Skeleton height="96px" width="80px" borderRadius="0.6rem" className="flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton height="12px" width="60%" />
          <Skeleton height="12px" width="40%" />
          <Skeleton height="12px" width="50%" />
        </div>
      </div>
    ))}
  </div>
);

const showMomenti = import.meta.env.VITE_MOMENTI_ATTIVI === 'true';
const showMenabo = import.meta.env.VITE_MENABO_ATTIVO === 'true';

function Main() {
  const refDropzone = useRef<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissionContext();
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
    ? dayjs().isAfter(dayjs(currentPromoData.validita_al, "DD/MM/YYYY"), "day") ||
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
          throw new Error(
            JSON.stringify({
              success: false,
              file: file.name,
              status: result.status,
              message: "Upload del tracciato non riuscito",
              details: text || null,
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
          message: "Errore sconosciuto",
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
      const result = await ServerCall.put<PromoResponseDTO>(
        `/promo/${data.id}`,
        data
      );
      return result;
    },
    onSuccess: async () => {
      showNotification(
        <div className="flex flex-row items-center">
          <Lucide icon="CircleCheck" className="text-success w-8 h-8" />
          <div className="ml-4 mr-4">
            <div className="font-bold">Lavorazione aggiornata con successo</div>
          </div>
        </div>
      );
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
  const validateSharedContext = (): boolean => {
    const errors: { [fieldName: string]: string } = {};

    const currentContext = contextLavorazione;
    const currentFieldValues = fieldValues;

    currentContext.forEach((c) => {
      // se le dipendenze non sono soddisfatte, il campo è "nascosto" -> non lo validiamo
      if (!areDependenciesMet(c.dipendenze, currentFieldValues)) return;

      // se nullable === true -> opzionale
      if (c.nullable === true) return;

      let value: any = c.user_value;

      // caso speciale idLabel + label personalizzata
      if (c.nome_field === "idLabel" && currentFieldValues["idLabel"] === "lblpers") {
        value = customLabelValue;
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

    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditFormData({} as UpdatePromoDTO & { id: string });
    setEditContextLavorazione([]);
    setEditFieldValues({});
    setEditCustomLabelValue("");
    setEditContextErrors({});
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

  const validateEditForm = (): string[] => {
    const errors: string[] = [];

    if (!editFormData.id) {
      errors.push("L'ID della lavorazione è obbligatorio");
    }

    if (!editFormData.nome || editFormData.nome.trim() === "") {
      errors.push("Il nome della lavorazione è obbligatorio");
    }

    if (editFormData.validita_dal && editFormData.validita_al) {
      const dataInizio = dayjs(editFormData.validita_dal);
      const dataFine = dayjs(editFormData.validita_al);

      if (dataInizio.isAfter(dataFine)) {
        errors.push(
          "La data di inizio deve essere precedente alla data di fine"
        );
      }
    }

    if (editFormData.validita_dal && editFormData.data_scadenza) {
      const dataInizio = dayjs(editFormData.validita_dal);
      const dataScadenza = dayjs(editFormData.data_scadenza);

      if (dataScadenza.isAfter(dataInizio)) {
        errors.push(
          "La data di scadenza non può essere successiva alla data di inizio"
        );
      }
    }

    if (
      editFormData.offset_visibilita !== undefined &&
      editFormData.offset_visibilita < 0
    ) {
      errors.push("L'offset di visibilità deve essere un numero positivo");
    }

    return errors;
  };

  const handleEditSave = async () => {
    const validationErrors = validateEditForm();

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
  };

  const getStatusBadgeProps = (stato: STATO_PROMO) => {
    switch (stato) {
      case STATO_PROMO.PIANIFICATA:
        return { variant: "info" as const, text: "Pianificata", icon: "Calendar" };
      case STATO_PROMO.IN_LAVORAZIONE:
        return { variant: "warning" as const, text: "In Lavorazione", icon: "Clock" };
      case STATO_PROMO.IN_SCADENZA:
        return { variant: "warning" as const, text: "In Scadenza", icon: "Activity" };
      case STATO_PROMO.IN_ATTESA_DI_VALIDITA:
        return { variant: "info" as const, text: "In Attesa di Validità", icon: "PauseCircle" };
      case STATO_PROMO.IN_RITARDO:
        return { variant: "error" as const, text: "In Ritardo", icon: "AlertTriangle" };
      case STATO_PROMO.VALIDA:
        return { variant: "success" as const, text: "Attiva", icon: "CircleCheck" };
      case STATO_PROMO.VALIDA_CON_ERRORI:
        return { variant: "warning" as const, text: "Attiva con Errori", icon: "AlertTriangle" };
      case STATO_PROMO.ARCHIVIATA:
        return { variant: "info" as const, text: "Archiviata", icon: "Archive" };
      case STATO_PROMO.ELIMINATA:
        return { variant: "error" as const, text: "Eliminata", icon: "CircleX" };
      default:
        return { variant: "info" as const, text: "Valore non leggibile", icon: "Info" };
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return "N/A";
    return dayjs(date).format("[Il] DD/MM/YYYY [Alle] HH:mm:ss");
  };

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

  const renderQuickActions = () => {
    return (
      <Suspense
        fallback={
          <div className="col-span-12 lg:col-span-4 h-full">
            <div className="box box--stacked h-full">
              <div className="flex flex-col p-4 h-full">
                <div className="flex items-center mb-4">
                  <Skeleton className="w-8 h-8 rounded-full mr-2" />
                  <div>
                    <Skeleton className="w-32 h-5 mb-1" />
                    <Skeleton className="w-24 h-3" />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-3/4 h-10" />
                </div>
              </div>
            </div>
          </div>
        }
      >

        {!isPromoFinalState(currentPromoData?.stato) && (
          <Await
            resolve={lavorazioni}
            errorElement={
              <div className="col-span-12 h-full">
                <div className="box box--stacked h-full">
                  <div className="flex flex-col p-4 h-full">
                    <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-center py-6">
                      <Lucide icon="CircleAlert" className="w-6 h-6 text-danger" />
                      <h4 className="font-medium text-slate-700 mb-2">
                        Si è verificato un errore
                      </h4>
                      <p className="text-sm text-slate-500 mb-4">
                        Non è stato possibile recuperare i dati delle lavorazioni
                      </p>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => refreshContent()}
                        className="w-full"
                      >
                        <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
                        Riprova
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            }
          >
            {(lavorazioniResolved: any[] | null) => {
              return (
                <div className="col-span-12 h-full space-y-4">
                  {/* Accesso Materiali - sempre visibile */}


                  <div className="box box--stacked h-full">
                    <div className="flex flex-col p-4 h-full">
                      <div className="flex-1 flex flex-col items-center justify-center space-y-3 text-center py-6">
                        <Lucide icon="Package" className="w-6 h-6 text-primary" />
                        <h4 className="font-medium text-slate-700 mb-2">
                          Gestione Kit
                        </h4>
                        <p className="text-sm text-slate-500 mb-4">
                          Accedi alla pagina di gestione dei kit per questa
                          lavorazione.
                        </p>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="w-full"
                          onClick={() =>
                            navigate(
                              `/promozioni/in-corso/dettagli/${idPromo}/kits`
                            )
                          }
                        >
                          <Lucide icon="ArrowRight" className="w-4 h-4 mr-2" />
                          Vai ai Kit
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          </Await>
        )}
      </Suspense>
    );
  };

  const renderUploadForm = () => {
    if (hasPermission("file.upload_tracciato")) {
      if (isExpired) {
        return (
          <div className="border border-danger/20 rounded-lg p-4 bg-danger/5 mb-4">
            <div className="flex items-center mb-3">
              <Lucide icon="Info" className="w-4 h-4 text-danger mr-2" />
              <h4 className="font-medium text-danger">Lavorazione Scaduta</h4>
            </div>
            <p className="text-sm text-slate-600">
              Questa lavorazione è scaduta il {formatDate(currentPromoData?.data_scadenza)}. Non è più possibile caricare nuovi tracciati.
            </p>
          </div>
        );
      }

      return (
        <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 mb-4">
          <div className="flex items-center mb-3">
            <Lucide icon="Upload" className="w-4 h-4 text-primary mr-2" />
            <h4 className="font-medium text-primary">Carica Nuovo Tracciato</h4>
          </div>

          <div className="space-y-3">
            {files.length === 0 ? (
              <Dropzone
                options={{
                  dragend: (event) => console.log("Drag end", event),
                  dragenter: (event) => console.log("Drag enter", event),
                  addedfiles: (dzFiles) => {
                    const addedFiles = Array.from(dzFiles) as unknown as File[];
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
                className="dropzone border-2 border-dashed border-primary/30 rounded-lg p-4 text-center hover:border-primary/50 transition-colors"
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
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Lucide icon="Upload" className="w-4 h-4 text-primary" />
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
              <div className="border rounded-lg p-3 bg-white">
                {/* Lista file selezionati */}
                <div className="space-y-2 mb-3">
                  {files.map((f, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-slate-50 rounded px-2 py-1 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Lucide
                          icon="FileText"
                          className="w-3 h-3 text-primary flex-shrink-0"
                        />
                        <span className="truncate">{f.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSingleFile(idx)}
                        className="text-danger hover:text-danger/80"
                        title="Rimuovi questo file"
                      >
                        <Lucide icon="Trash2" className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[11px] text-slate-400">
                      {files.length} file selezionat
                      {files.length !== 1 ? "i" : "o"}.
                    </span>
                    <Button
                      variant="outline-danger"
                      size="xs"
                      onClick={handleRemoveFile}
                    >
                      <Lucide icon="Trash2" className="w-3 h-3 mr-1" />
                      Rimuovi tutti
                    </Button>
                  </div>
                </div>

                {/* Stato caricamento o configurazione contesto */}
                {isUploading ? (
                  <div className="text-center py-4">
                    <div className="flex justify-center mb-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-sm font-medium">Caricamento...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Suspense fallback={<Skeleton className="w-full h-32" />}>
                      {contextLavorazioneQuery.isLoading ? (
                        <div className="border rounded-lg p-3 bg-slate-50">
                          <h5 className="text-sm font-medium mb-3 flex items-center">
                            <Lucide icon="Settings" className="w-3 h-3 mr-1" />
                            Configurazione
                          </h5>
                          <div className="space-y-3">
                            <Skeleton className="w-full h-8" />
                            <Skeleton className="w-full h-8" />
                            <Skeleton className="w-full h-8" />
                          </div>
                        </div>
                      ) : contextLavorazioneQuery.isError ? (
                        <EmptyState
                          title="Errore caricamento contesto"
                          description="Si è verificato un errore durante il caricamento del contesto"
                          icon="CircleAlert"
                        />
                      ) : (useSharedContext
                        ? contextLavorazione?.length > 0
                        : fileContexts.length > 0) ? (
                        <div className="border rounded-lg p-3 bg-slate-50">
                          {/* Header configurazione + toggle */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-1">
                              <Lucide icon="Settings" className="w-3 h-3 mr-1" />
                              <h5 className="text-sm font-medium">
                                Configurazione
                              </h5>
                            </div>
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
                                              {currentCustomLabelValue.length > MAX_CHAR_CUSTOM_LABEL && (
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
                <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full mr-2" />
                    <div className="flex-1">
                      <Skeleton className="w-48 h-5 mb-1" />
                      <Skeleton className="w-36 h-3" />
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-primary/30 rounded-lg p-6">
                    <div className="space-y-2 text-center">
                      <div className="flex justify-center">
                        <div className="w-8 h-8 bg-primary/10 rounded-full" />
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
              <div key={i} className="border rounded-lg p-3">
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
          <div className="text-center py-8">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Lucide icon="CircleAlert" className="w-6 h-6 text-red-500" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-red-700 mb-2">
              Errore nel caricamento
            </h3>
            <p className="text-red-600 mb-3">
              Si è verificato un errore durante il recupero dei tracciati
            </p>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => refreshContent()}
            >
              <Lucide icon="RefreshCw" className="w-4 h-4 mr-2" />
              Riprova
            </Button>
          </div>
        ) : (
          (() => {
            const tracciati = tracciatiQuery.data ?? [];
            if (tracciati.length === 0) {
              return (
                <>
                  {renderUploadForm()}
                  {!isExpired && (
                    <EmptyState
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
                  {tracciati.map((tracciato: TracciatiResponseDTO) => (
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
                      promoStorico={promoQuery.data?.is_active || false}
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
              <Skeleton height="h-4" className="w-full" />
              <Skeleton height="h-6" className="w-3/4" />
            </div>
          ))}
        </div>
      );
    }

    if (isEditing) {
      return renderEditForm();
    }

    const statusProps = getStatusBadgeProps(currentPromoData.stato);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-slate-500 justify-center">
            <Lucide icon="Tag" className="w-4 h-4 mr-1" />
            Nome Promozione
          </div>
          <div className="text-lg font-semibold text-slate-800 text-center">
            {currentPromoData.nome}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-sm text-slate-500 justify-center">
            <Lucide icon="Eye" className="w-4 h-4 mr-1" />
            Offset Visibilità
          </div>
          <div className="text-lg font-semibold text-slate-800 text-center">
            {currentPromoData.offset_visibilita}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-sm text-slate-500 justify-center">
            <Lucide icon="Play" className="w-4 h-4 mr-1" />
            Data Inizio
          </div>
          <div className="text-lg font-semibold text-slate-800 text-center">
            {dayjs(currentPromoData.validita_dal).format("DD/MM/YYYY")}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-sm text-slate-500 justify-center">
            <Lucide icon="CircleStop" className="w-4 h-4 mr-1" />
            Data Fine
          </div>
          <div className="text-lg font-semibold text-slate-800 text-center">
            {dayjs(currentPromoData.validita_al).format("DD/MM/YYYY")}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-sm text-slate-500 justify-center">
            <Lucide icon="Calendar" className="w-4 h-4 mr-1" />
            Data Scadenza
          </div>
          <div className="text-lg font-semibold text-slate-800 text-center">
            {dayjs(currentPromoData.data_scadenza).format("DD/MM/YYYY")}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-sm text-slate-500 justify-center">
            <Lucide icon={statusProps.icon as any} className="w-4 h-4 mr-1" />
            Stato
          </div>
          <div className="inline-flex items-center justify-center w-full">
            <Badge size="sm" border variant={statusProps.variant}>
              <Lucide icon={statusProps.icon as any} className="w-3 h-3 mr-1" />
              {statusProps.text}
            </Badge>
          </div>
        </div>
      </div>
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
              className="w-full"
              placeholder="Inserisci il nome della lavorazione"
              required
            />
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
              className="w-full"
              placeholder="Offset visibilità"
            />
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
              className="w-full"
            />
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
              className="w-full"
            />
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
              className="w-full"
            />
            <p className="text-xs text-slate-500">
              Data di scadenza per la lavorazione
            </p>
          </div>
        </div>

        {/* Sezione contesto modificabile */}
        {isLoadingContestoPerNuovaLavorazione ? (
          <div className="border rounded-[0.6rem] dark:border-darkmode-400 relative mt-2 border-slate-200/80">
            <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white text-slate-500">
              <div className="-mt-px">Specifiche di lavorazione</div>
            </div>
            <div className="px-5 py-4 mt-4 flex flex-col gap-3.5">
              <Skeleton height="40px" className="rounded-md" />
              <Skeleton height="40px" className="rounded-md" />
              <Skeleton height="40px" className="rounded-md" />
            </div>
          </div>
        ) : editContextLavorazione.length > 0 ? (
          <div className="border rounded-[0.6rem] dark:border-darkmode-400 relative mt-2 border-slate-200/80">
            <div className="absolute left-0 px-3 ml-4 -mt-2 text-xs uppercase bg-white text-slate-500">
              <div className="-mt-px">Specifiche di lavorazione</div>
            </div>
            <div className="px-5 py-4 mt-4">
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
            </div>
          </div>
        ) : null}

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
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
              disabled={updatePromoMutation.isPending}
            >
              {updatePromoMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Salvataggio...
                </>
              ) : (
                <>
                  <Lucide icon="Save" className="w-4 h-4 mr-2" />
                  Salva Modifiche
                </>
              )}
            </Button>
          </PermissionGate>
        </div>
      </div>
    );
  };

  return (
    <Fragment>
      {/* Dialog Anteprima */}


      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <PageHeader
          title="Dettagli Promozione"
          description={
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {currentPromoData?.nome || "Caricamento..."}{" "}
                <span className="text-xs italic">
                  (creata il{" "}
                  {formatDate(currentPromoData?.data_registrazione)})
                </span>
              </span>
            </div>
          }
        />
      </div>

      {currentPromoData &&
        isEndDateNear(currentPromoData.validita_al) &&
        !isExpired && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Lucide
                  icon="Clock"
                  className="w-5 h-5 text-orange-600 mt-0.5"
                />
              </div>
              <div className="ml-3">
                <div className="flex items-center">
                  <h3 className="text-sm font-semibold text-orange-800">
                    Scadenza Imminente
                  </h3>
                  <Badge variant="warning" size="sm" className="ml-2">
                    {getDaysUntilEnd(currentPromoData.validita_al)} giorni rimasti
                  </Badge>
                </div>
                <p className="text-sm text-orange-700 mt-1">
                  La lavorazione scadrà il{" "}
                  <strong>
                    {formatDate(currentPromoData.validita_al)}
                  </strong>
                  . Assicurati di completare tutte le attività prima della
                  scadenza.
                </p>
              </div>
            </div>
          </div>
        )}

      <div className="grid grid-cols-12 gap-6 mt-4">
        <div className="col-span-12 ">
          <div className="box box--stacked">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mr-2">
                    <Lucide icon="Info" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Informazioni Promozione
                    </h3>
                    <p className="text-sm text-slate-500">
                      Dettagli e configurazione della promozione corrente
                    </p>
                  </div>
                </div>
                {!isEditing &&
                  currentPromoData &&
                  currentPromoData.stato !== STATO_PROMO.ELIMINATA &&
                  !isPromoFinalState(currentPromoData?.stato) && (
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={handleEditStart}
                      className="flex items-center"
                    >
                      <Lucide icon="Pencil" className="w-4 h-4 mr-2" />
                      Modifica
                    </Button>
                  )}
              </div>
              {renderLavorazioneDetails()}
            </div>
          </div>
        </div>
        {/* Sezione Volantini della Promozione */}
        <div className="col-span-12 space-y-6">
          {showMenabo && (
            <div className="box box--stacked ">
              <div className="p-5">
                <div className="flex flex-col gap-1 ">
                  <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                        <Lucide icon="Grid3x3" className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-base font-semibold">Gestisci Menabò</div>
                        <div className="text-slate-500 text-sm">Gestisci il menabò dei volantini, pronto per la visualizzazione e il download.</div>
                      </div>
                    </div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => {
                        if (isPromoFinalState(currentPromoData?.stato)) {
                          navigate(`/promozioni/storico/dettagli/${idPromo}/menabo`);
                        } else {
                          navigate(`/promozioni/in-corso/dettagli/${idPromo}/menabo`);
                        }
                      }}
                    >
                      <Lucide icon="ArrowRight" className="w-4 h-4 mr-2" />
                      Vai al Menabò
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="box box--stacked">
            <div className="p-5">
              <div className="flex flex-col gap-1 mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                    <Lucide icon="BookOpen" className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">Volantini della Promozione</div>
                    <div className="text-slate-500 text-sm">File volantini pronti per download e visualizzazione</div>
                  </div>
                </div>
              </div>

              <React.Suspense fallback={<VolantiniSkeleton />}>
                <Await
                  resolve={volantini}
                  errorElement={
                    <EmptyState
                      icon="CircleAlert"
                      title="Errore di caricamento"
                      description="Non è stato possibile caricare i volantini"
                      iconColor="text-danger"
                    />
                  }
                >
                  {(volantiniResolved: VolantinoKit[] | null) => {
                    if (!volantiniResolved || volantiniResolved.length === 0) {
                      return (
                        <EmptyState
                          icon="FolderOpen"
                          title="Nessun volantino disponibile"
                          description="Non ci sono file volantini pronti per questa promozione"
                          iconColor="text-slate-400"
                        />
                      );
                    }

                    return (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                        {volantiniResolved.map((kit: VolantinoKit) => (
                          <VolantinoFileCard
                            key={kit.guidId}
                            kit={kit}
                            idPromo={idPromo || ""}
                            onNavigate={(kitId) => {
                              if (isPromoFinalState(currentPromoData?.stato)) {
                                navigate(`/promozioni/storico/dettagli/${idPromo}/kits/${kitId}`)
                              } else {
                                navigate(`/promozioni/in-corso/dettagli/${idPromo}/kits/${kitId}`)
                              }
                            }}
                            validitaDal={currentPromoData?.validita_dal.toString()}
                            validitaAl={currentPromoData?.validita_al.toString()}
                          />
                        ))}
                      </div>
                    );
                  }}
                </Await>
              </React.Suspense>
            </div>
          </div>

        </div>
        <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {idPromo && isPromoFinalState(currentPromoData?.stato) && (
            // <div className="col-span-12 box box--stacked">
            //   <PromoMaterialiAccess idPromo={idPromo} />
            // </div>
            <div className="box box--stacked col-span-12">
              <div className="p-5">
                <div className="flex flex-col gap-1 ">
                  <div className="flex items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                        <Lucide icon="Grid3x3" className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="text-base font-semibold">  Materiali Promozione</div>
                        <div className="text-slate-500 text-sm">Visualizza i materiali per questa promozione</div>
                      </div>
                    </div>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => {
                        navigate(`/promozioni/storico/dettagli/${idPromo}/materiali`);
                      }}
                    >
                      <Lucide icon="FolderOpen" className=" w-4 h-4 mr-2" />
                      Visualizza Materiali
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="col-span-12 lg:col-span-4 flex flex-col">
            {renderQuickActions()}
          </div>

          <div
            className={clsx(
              "col-span-12 flex flex-col",
              !isPromoFinalState(currentPromoData?.stato) && "lg:col-span-8"
            )}
          >
            <div className="box box--stacked h-full">
              <div className="p-4">
                <div className="flex items-center mb-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mr-2">
                    <Lucide icon="ChartPie" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Stato Lavorazioni</h3>
                    <p className="text-sm text-slate-500">
                      Panoramica dello stato delle lavorazioni
                    </p>
                  </div>
                </div>

                <React.Suspense
                  fallback={
                    <div className="flex flex-col lg:flex-row items-center justify-center min-h-[220px]">
                      <div className="w-full lg:w-1/2 flex justify-center">
                        <Skeleton className="w-48 h-48 rounded-full" />
                      </div>
                      <div className="w-full lg:w-1/2 mt-4 lg:mt-0 lg:pl-6 space-y-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    </div>
                  }
                >
                  <Await
                    resolve={Promise.all([
                      datoGraficoPaginaLavorazioni,
                      lavorazioni,
                    ])}
                    errorElement={
                      <div className="col-span-12 lg:col-span-4">
                        <div className="flex flex-col p-4 h-full items-center justify-center text-center">
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-error/10 mb-3">
                            <Lucide
                              icon="CircleAlert"
                              className="w-6 h-6 text-error"
                            />
                          </div>
                          <h3 className="text-lg font-semibold text-error-700">
                            Errore di Caricamento
                          </h3>
                          <p className="text-sm text-slate-500">
                            Impossibile caricare i dati del grafico.
                          </p>
                        </div>
                      </div>
                    }
                  >
                    {([datoGrafico, lavorazioniResolved]: [any, any[] | null]) => (
                      <div className="flex flex-col lg:flex-row items-center justify-center">
                        <div className="w-full lg:w-1/2 flex justify-center">
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

                        <div className="w-full lg:w-1/2 mt-4 lg:mt-0 lg:pl-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-2 bg-primary/5 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-primary/60 mr-2"></div>
                                <span className="font-medium text-sm">
                                  In Lavorazione
                                </span>
                              </div>
                              <Badge variant="primary" size="sm">
                                {
                                  lavorazioniResolved?.filter(
                                    (lavorazione: any) =>
                                      lavorazione.stato_lavorazione ===
                                      STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE
                                  ).length
                                }
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-success/5 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-success/60 mr-2"></div>
                                <span className="font-medium text-sm">
                                  Completate
                                </span>
                              </div>
                              <Badge variant="success" size="sm">
                                {
                                  lavorazioniResolved?.filter(
                                    (lavorazione: any) =>
                                      lavorazione.stato_lavorazione ===
                                      STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO
                                  ).length
                                }
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-warning/5 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-warning/60 mr-2"></div>
                                <span className="font-medium text-sm">
                                  In revisione
                                </span>
                              </div>
                              <Badge variant="warning" size="sm">
                                {
                                  lavorazioniResolved?.filter(
                                    (lavorazione: any) =>
                                      lavorazione.stato_lavorazione ===
                                      STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE
                                  ).length
                                }
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-danger/5 rounded-lg">
                              <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-danger/60 mr-2">
                                  .
                                </div>
                                <span className="font-medium text-sm">
                                  In attesa di partenza
                                </span>
                              </div>
                              <Badge variant="error" size="sm">
                                {
                                  lavorazioniResolved?.filter(
                                    (lavorazione: any) =>
                                      lavorazione.isDesignKit === true
                                  ).length
                                }
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Await>
                </React.Suspense>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12">
          <div className="box box--stacked">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mr-2">
                    <Lucide icon="Files" className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Tracciati Caricati</h3>
                    <p className="text-sm text-slate-500">
                      {(() => {
                        const count = tracciatiQuery.data?.length || 0;
                        if (tracciatiQuery.isLoading) return "Caricamento...";
                        if (count === 0) return "Nessun tracciato disponibile";
                        return `${count} tracciat${count !== 1 ? "i" : "o"} disponibil${count !== 1 ? "i" : "e"}`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
              {renderTracciatiContent()}
            </div>
          </div>
        </div>
        {showMomenti && (
          <div className="col-span-12 mb-12">
            <div className="box box--stacked">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 mr-2">
                      <Lucide icon="Timer" className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Gestione momenti</h3>
                      <p className="text-sm text-slate-500">
                        Gestisci i momenti in cui sono state importate le liste per l'analisi successiva dei dati.
                      </p>
                    </div>
                  </div>
                </div>
                <GestioneMomenti
                  idPromo={idPromo}
                  tracciati={tracciatiQuery.data ?? []}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Fragment>
  );
}

export default withSessionCheckOptimized(Main);
