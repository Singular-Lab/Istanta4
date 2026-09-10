import crypto from 'node:crypto';
import { TIPO_LAVORAZIONE } from '../../../lib/enums';
import { FileItemKit } from '../../../lib/types';
import config from '../config';
import type { FlyerFilePreviewDTO } from '../dto';

/**
 * Shared utility functions for runtime file DTO building.
 * Used by VolantinoService and PromoService.
 */

export function getTipoLavorazioneLabel(value?: number): string {
  switch (value) {
    case TIPO_LAVORAZIONE.VOLANTINO:
      return 'Volantino';
    case TIPO_LAVORAZIONE.POP:
      return 'POP';
    default:
      return 'N/D';
  }
}

export function buildRuntimeThumbnail(file: FileItemKit): string | undefined {
  if (file.id_olimpo_cloud) {
    return `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}`;
  }
  return file.url;
}

export function buildRuntimeDownloadUrl(file: FileItemKit): string | undefined {
  if (file.id_olimpo_cloud) {
    return `${config.OLYMPUS_IP_ADDRESS}/materiali/getMaterialePDF?id=${file.id_olimpo_cloud}`;
  }
  return file.url;
}

export function buildRuntimePagePreviews(file: FileItemKit, pages: number): string[] {
  if (!file.id_olimpo_cloud) {
    return file.url ? [file.url] : [];
  }
  const safePages = pages > 0 ? pages : 1;
  return Array.from({ length: safePages }, (_, index) =>
    `${config.OLYMPUS_IP_ADDRESS}/materiali/getThumbnailMaterialePdfs?&id=${file.id_olimpo_cloud}&page=${index + 1}`
  );
}

export function mapRuntimeFileToHistoryDto(file: FileItemKit): FlyerFilePreviewDTO {
  const meta = file.meta_olimpo_cloud as Record<string, unknown> | undefined;
  const metaPagesValue = meta?.['pages'];
  const metaPages = typeof metaPagesValue === 'number' ? metaPagesValue : undefined;
  const safePages = file.pages && file.pages > 0
    ? file.pages
    : metaPages && metaPages > 0
      ? metaPages
      : 1;

  return {
    id: file.id ?? file.id_olimpo_cloud ?? crypto.randomUUID(),
    runtimeId: file.id_runtime,
    nome: file.nome ?? file.nome_originale ?? 'File senza nome',
    nomeOriginale: file.nome_originale,
    tipoExport: file.tipo_export,
    tipoExportCodice: (file as any).tipo_export_codice,
    mime: file.mime,
    pages: safePages,
    thumbnailUrl: buildRuntimeThumbnail(file),
    downloadUrl: buildRuntimeDownloadUrl(file),
    pagePreviews: buildRuntimePagePreviews(file, safePages),
    meta: meta
  };
}
