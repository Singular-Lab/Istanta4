import { cloneHubServiceMetaWithoutRedirect } from "./hubServiceRedirect";
import type {
  HubServiceDocumentAsset,
  HubServiceVideoAsset,
  HubServiceVideoKind,
} from "./types";

function sanitizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function sanitizeVideoKind(value: unknown): HubServiceVideoKind {
  return value === "trailer" ? "trailer" : "guide";
}

function sanitizeDocumentAsset(value: unknown): HubServiceDocumentAsset | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const id = sanitizeString(raw.id);
  const title = sanitizeString(raw.title);
  const originalName = sanitizeString(raw.original_name);
  const mimeType = sanitizeString(raw.mime_type);
  const size = sanitizeNumber(raw.size);
  const olympusId = sanitizeString(raw.id_olimpo_cloud);
  const downloadUrl = sanitizeString(raw.download_url);

  if (!id || !title || !originalName || !mimeType || size === undefined || !olympusId || !downloadUrl) {
    return null;
  }

  return {
    id,
    title,
    original_name: originalName,
    mime_type: mimeType,
    size,
    extension: sanitizeString(raw.extension),
    id_olimpo_cloud: olympusId,
    download_url: downloadUrl,
    preview_url: sanitizeString(raw.preview_url),
    pages: sanitizeNumber(raw.pages),
  };
}

function sanitizeVideoAsset(value: unknown): HubServiceVideoAsset | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const id = sanitizeString(raw.id);
  const title = sanitizeString(raw.title);
  const originalName = sanitizeString(raw.original_name);
  const mimeType = sanitizeString(raw.mime_type);
  const size = sanitizeNumber(raw.size);
  const guidId = sanitizeString(raw.guid_id);
  const url = sanitizeString(raw.url);

  if (!id || !title || !originalName || !mimeType || size === undefined || !guidId || !url) {
    return null;
  }

  return {
    id,
    title,
    kind: sanitizeVideoKind(raw.kind),
    original_name: originalName,
    mime_type: mimeType,
    size,
    guid_id: guidId,
    url,
  };
}

export function normalizeHubServiceDocuments(value: unknown): HubServiceDocumentAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeDocumentAsset(item))
    .filter((item): item is HubServiceDocumentAsset => Boolean(item));
}

export function normalizeHubServiceVideos(value: unknown): HubServiceVideoAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeVideoAsset(item))
    .filter((item): item is HubServiceVideoAsset => Boolean(item));
}

export function readHubServiceDocuments(meta?: Record<string, unknown> | null): HubServiceDocumentAsset[] {
  if (!meta || typeof meta !== "object") return [];
  return normalizeHubServiceDocuments(meta.documents);
}

export function readHubServiceVideos(meta?: Record<string, unknown> | null): HubServiceVideoAsset[] {
  if (!meta || typeof meta !== "object") return [];
  return normalizeHubServiceVideos(meta.videos);
}
export function sanitizeMetaHubService(meta?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") return {};
  // Deep clone using structuredClone if available, fallback to JSON
  let newMeta: Record<string, unknown>;
  if (typeof structuredClone === "function") {
    newMeta = structuredClone(meta);
  } else {
    newMeta = JSON.parse(JSON.stringify(meta));
  }
  if ("video" in newMeta) {
    delete newMeta.video;
  }
  if ("documents" in newMeta) {
    delete newMeta.documents;
  }
  return newMeta;
}

export function cloneHubServiceMetaWithoutManagedContent(meta?: Record<string, unknown> | null): Record<string, unknown> {
  const nextMeta = cloneHubServiceMetaWithoutRedirect(meta);
  delete nextMeta.documents;
  delete nextMeta.videos;
  return nextMeta;
}
