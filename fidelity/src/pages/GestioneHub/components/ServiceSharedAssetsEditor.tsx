import Button from "@/components/Base/Button";
import { FormInput, FormLabel, FormSelect } from "@/components/Base/Form";
import Badge from "@/components/Base/Badge";
import Lucide from "@/components/Base/Lucide";
import StatCard from "@/components/Base/StatCard";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { useRef } from "react";
import type { HubServiceVideoKind } from "../../../../lib/types";
import type {
  ServiceDialogMode,
  ServiceDocumentFormValue,
  ServiceVideoFormValue,
} from "../types";

interface ServiceSharedAssetsEditorProps {
  mode: ServiceDialogMode;
  documents: ServiceDocumentFormValue[];
  videos: ServiceVideoFormValue[];
  onDocumentsChange: (documents: ServiceDocumentFormValue[]) => void;
  onVideosChange: (videos: ServiceVideoFormValue[]) => void;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function inferTitle(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return baseName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || fileName;
}

function createClientId(): string {
  if (
    typeof globalThis !== "undefined" &&
    "crypto" in globalThis &&
    typeof globalThis.crypto?.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `service-asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const VIDEO_KIND_OPTIONS: Array<{ value: HubServiceVideoKind; label: string }> = [
  { value: "trailer", label: "Trailer" },
  { value: "guide", label: "Video guida" },
];

const SECTION_SURFACE_CLASS = "rounded-card border border-slate-200 bg-white p-4 sm:p-5";
const ASSET_GROUP_CLASS = "rounded-card border border-slate-200 bg-slate-50 p-4 sm:p-5";
const ASSET_CARD_CLASS = "rounded-card border border-slate-200 bg-white p-4";

const ServiceSharedAssetsEditor = ({
  mode,
  documents,
  videos,
  onDocumentsChange,
  onVideosChange,
}: ServiceSharedAssetsEditorProps) => {
  const editable = mode === "create" || mode === "edit-group";
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const appendDocuments = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const nextItems = Array.from(fileList).map((file) => ({
      id: createClientId(),
      title: inferTitle(file.name),
      original_name: file.name,
      mime_type: file.type || "application/octet-stream",
      size: file.size,
      extension: file.name.includes(".")
        ? `.${file.name.split(".").pop()?.toLowerCase()}`
        : undefined,
      id_olimpo_cloud: "",
      download_url: "",
      preview_url: undefined,
      pages: undefined,
      file,
    }));

    onDocumentsChange([...documents, ...nextItems]);
  };

  const appendVideos = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const nextItems = Array.from(fileList).map((file, index) => ({
      id: createClientId(),
      title: inferTitle(file.name),
      kind: videos.length === 0 && index === 0 ? ("trailer" as const) : ("guide" as const),
      original_name: file.name,
      mime_type: file.type || "video/mp4",
      size: file.size,
      guid_id: "",
      url: "",
      file,
    }));

    onVideosChange([...videos, ...nextItems]);
  };

  const updateDocument = (id: string, patch: Partial<ServiceDocumentFormValue>) => {
    onDocumentsChange(
      documents.map((document) => (document.id === id ? { ...document, ...patch } : document))
    );
  };

  const updateVideo = (id: string, patch: Partial<ServiceVideoFormValue>) => {
    onVideosChange(videos.map((video) => (video.id === id ? { ...video, ...patch } : video)));
  };

  const removeDocument = (id: string) => {
    onDocumentsChange(documents.filter((document) => document.id !== id));
  };

  const removeVideo = (id: string) => {
    onVideosChange(videos.filter((video) => video.id !== id));
  };

  const pendingDocumentsCount = documents.filter(
    (document) => Boolean(document.file) && !document.id_olimpo_cloud
  ).length;
  const pendingVideosCount = videos.filter(
    (video) => Boolean(video.file) && !video.guid_id
  ).length;
  const totalAssets = documents.length + videos.length;
  const pendingAssets = pendingDocumentsCount + pendingVideosCount;

  return (
    <section className={SECTION_SURFACE_CLASS}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="title-eyebrow flex items-center gap-2">
              <Lucide icon="LibraryBig" aria-hidden="true" className="h-3.5 w-3.5" />
              Contenuti condivisi
            </p>
            <h3 className="title-card mt-2">
              Documentazioni e video del gruppo servizio
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Carica i file, completa i metadati e salva: il caricamento su Olimpo avviene al
              salvataggio. In modalita <strong>Modifica gruppo</strong> l&apos;aggiornamento vale per
              tutte le varianti; in <strong>Modifica variante</strong> solo per la variante
              selezionata.
            </p>
          </div>

          {!editable && (
            <div className="rounded-control border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 lg:max-w-xs">
              Modifica non disponibile in modalita{" "}
              <span className="font-semibold text-slate-800">Aggiungi variante</span>.
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Documentazioni"
            valore={documents.length}
            sottotitolo={pendingDocumentsCount > 0 ? `${pendingDocumentsCount} da caricare su Olimpo` : "Tutte sincronizzate"}
          />
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Video"
            valore={videos.length}
            sottotitolo={pendingVideosCount > 0 ? `${pendingVideosCount} da caricare su Olimpo` : "Tutti sincronizzati"}
          />
          <StatCard
            densita="compatta"
            tono="neutral"
            etichetta="Totale contenuti"
            valore={totalAssets}
            sottotitolo={pendingAssets > 0 ? `${pendingAssets} in attesa di upload` : "Nessun upload in attesa"}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <div className={ASSET_GROUP_CLASS}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                <Lucide icon="FileStack" className="h-4 w-4 shrink-0 text-primary" />
                <span>Documentazioni</span>
                <Badge variant="secondary" size="sm" border className="bg-white">{documents.length}</Badge>
                {pendingDocumentsCount > 0 && (
                  <StatusBadge tono="warning" etichetta={`${pendingDocumentsCount} da caricare`} />
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                PDF e documenti condivisi consultabili dal servizio.
              </div>
            </div>

            {editable && (
              <>
                <input
                  ref={documentInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    appendDocuments(event.target.files);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => documentInputRef.current?.click()}
                >
                  <Lucide icon="Plus" className="mr-1.5 h-3.5 w-3.5" />
                  Aggiungi
                </Button>
              </>
            )}
          </div>

          {documents.length === 0 ? (
            <EmptyState
              compatta
              icon="FileSearch"
              title="Nessuna documentazione associata"
              description="Aggiungi manuali, guide PDF o materiali di supporto."
              className="mt-4 border border-dashed border-slate-200"
            />
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((document) => {
                const pendingUpload = Boolean(document.file) && !document.id_olimpo_cloud;
                const showActions = Boolean(document.download_url) || editable;

                return (
                  <div key={document.id} className={ASSET_CARD_CLASS}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-primary/15 bg-primary/10 text-primary">
                          <Lucide icon="FileText" className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {document.original_name}
                            </div>
                            <StatusBadge tono={pendingUpload ? "warning" : "success"} etichetta={pendingUpload ? "Da caricare su Olimpo" : "Su Olimpo"} />
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>
                              {document.extension?.replace(".", "").toUpperCase() ||
                                document.mime_type}
                            </span>
                            <span className="text-slate-300">/</span>
                            <span>{formatBytes(document.size)}</span>
                            {document.pages ? (
                              <>
                                <span className="text-slate-300">/</span>
                                <span>{document.pages} pagine</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {showActions && (
                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                          {document.download_url && (
                            <Button
                              as="a"
                              href={document.download_url}
                              target="_blank"
                              rel="noreferrer"
                              variant="outline-secondary"
                              size="sm"
                              aria-label="Apri documento in una nuova scheda"
                            >
                              <Lucide aria-hidden="true" icon="ExternalLink" className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {editable && (
                            <Button
                              type="button"
                              variant="soft-danger"
                              size="sm"
                              onClick={() => removeDocument(document.id)}
                              aria-label="Rimuovi documento"
                            >
                              <Lucide aria-hidden="true" icon="Trash2" className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <FormLabel htmlFor={`document-title-${document.id}`}>
                        Titolo visualizzato
                      </FormLabel>
                      <FormInput
                        id={`document-title-${document.id}`}
                        value={document.title}
                        disabled={!editable}
                        onChange={(event) =>
                          updateDocument(document.id, { title: event.target.value })
                        }
                        className="mt-2"
                        placeholder="Ad esempio Manuale operativo"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={ASSET_GROUP_CLASS}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                <Lucide icon="Clapperboard" className="h-4 w-4 shrink-0 text-theme-2" />
                <span>Video</span>
                <Badge variant="secondary" size="sm" border className="bg-white">{videos.length}</Badge>
                {pendingVideosCount > 0 && (
                  <StatusBadge tono="warning" etichetta={`${pendingVideosCount} da caricare`} />
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Trailer e video guida riproducibili direttamente dal servizio.
              </div>
            </div>

            {editable && (
              <>
                <input
                  ref={videoInputRef}
                  type="file"
                  multiple
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  className="hidden"
                  onChange={(event) => {
                    appendVideos(event.target.files);
                    event.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline-secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Lucide icon="Plus" className="mr-1.5 h-3.5 w-3.5" />
                  Aggiungi
                </Button>
              </>
            )}
          </div>

          {videos.length === 0 ? (
            <EmptyState
              compatta
              icon="MonitorPlay"
              title="Nessun video associato"
              description="Aggiungi un trailer oppure una guida rapida del servizio."
              className="mt-4 border border-dashed border-slate-200"
            />
          ) : (
            <div className="mt-4 space-y-3">
              {videos.map((video) => {
                const pendingUpload = Boolean(video.file) && !video.guid_id;
                const showActions = Boolean(video.url) || editable;

                return (
                  <div key={video.id} className={ASSET_CARD_CLASS}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-theme-2/15 bg-theme-2/10 text-theme-2">
                          <Lucide icon="CirclePlay" className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-slate-800">
                              {video.original_name}
                            </div>
                            <StatusBadge tono={pendingUpload ? "warning" : "success"} etichetta={pendingUpload ? "Da caricare su Olimpo" : "Su Olimpo"} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{video.mime_type}</span>
                            <span className="text-slate-300">/</span>
                            <span>{formatBytes(video.size)}</span>
                          </div>
                        </div>
                      </div>

                      {showActions && (
                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
                          {video.url && (
                            <Button
                              as="a"
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                              variant="outline-secondary"
                              size="sm"
                              aria-label="Apri video in una nuova scheda"
                            >
                              <Lucide aria-hidden="true" icon="ExternalLink" className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {editable && (
                            <Button
                              type="button"
                              variant="soft-danger"
                              size="sm"
                              onClick={() => removeVideo(video.id)}
                              aria-label="Rimuovi video"
                            >
                              <Lucide aria-hidden="true" icon="Trash2" className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <div>
                        <FormLabel htmlFor={`video-title-${video.id}`}>Titolo visualizzato</FormLabel>
                        <FormInput
                          id={`video-title-${video.id}`}
                          value={video.title}
                          disabled={!editable}
                          onChange={(event) =>
                            updateVideo(video.id, { title: event.target.value })
                          }
                          className="mt-2"
                          placeholder="Ad esempio Trailer piattaforma"
                        />
                      </div>

                      <div>
                        <FormLabel htmlFor={`video-kind-${video.id}`}>Tipologia</FormLabel>
                        <FormSelect
                          id={`video-kind-${video.id}`}
                          value={video.kind}
                          disabled={!editable}
                          onChange={(event) =>
                            updateVideo(video.id, {
                              kind: event.target.value as HubServiceVideoKind,
                            })
                          }
                          className="mt-2"
                        >
                          {VIDEO_KIND_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </FormSelect>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default ServiceSharedAssetsEditor;
