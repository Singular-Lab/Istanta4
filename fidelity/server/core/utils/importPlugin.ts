import { BadRequestError } from '../../../lib/errors';
import type { LoghiReferenza, OrigineStorico } from '../../../lib/types';
import type { SyncJsonPluginPayload, SyncJsonPluginRef } from '../agenzia_lib/types';

/** Un logo della referenza come lo salva Istanta: attivo, con l'immagine di Olimpo in guidId. */
export type LogoReferenza = LoghiReferenza & { attiva: true };

/**
 * I loghi e i bolli di un box del plugin (foto_extra) nella forma di quelli che Istanta assegna
 * alle referenze, letta da WebPliant, API esterne e insight (spec import-storico-volantino,
 * "Loghi e bolli delle referenze dello storico"). Si tengono solo quelli caricati su Olimpo, con
 * sigla e tipo: un logo non caricato ha guid_id vuoto e non si puo' mostrare. Mai un errore: un
 * logo scartato non ferma la sincronizzazione.
 */
export function loghiDelPlugin(fotoExtra: unknown): LogoReferenza[] {
  if (!Array.isArray(fotoExtra)) return [];
  return fotoExtra.flatMap((voce: unknown) => {
    if (voce === null || typeof voce !== 'object') return [];
    const { sigla, tipo, guid_id: guidIdPlugin, guidId: guidIdIstanta } = voce as Record<string, unknown>;
    const guidId = typeof guidIdPlugin === 'string' && guidIdPlugin.trim() !== '' ? guidIdPlugin : guidIdIstanta;
    if (typeof guidId !== 'string' || guidId.trim() === '') return [];
    if (typeof sigla !== 'string' || sigla.trim() === '') return [];
    if (typeof tipo !== 'number' || !Number.isFinite(tipo)) return [];
    return [{ tipo, sigla: sigla.trim(), guidId: guidId.trim(), attiva: true as const }];
  });
}

export function validaImportFinale(payload: SyncJsonPluginPayload): {
  refs: SyncJsonPluginRef[];
  report: Omit<OrigineStorico, 'importatoIl' | 'nomeFile'>;
} {
  const refs = payload.refs as SyncJsonPluginRef[];
  const report = payload.reportStorico as Omit<OrigineStorico, 'importatoIl' | 'nomeFile'>;
  const compilati = report.boxFuoriListino.filter((box) => !box.ignorato);
  const totaleCompilati = compilati.reduce((totale, box) => totale + box.referenze.length, 0);
  if (
    report.nonImpaginate.length > 0 && !report.lasciapassareNonImpaginate ||
    report.referenzeDaListino! + totaleCompilati !== refs.length ||
    report.totaleFuoriListino !== totaleCompilati ||
    report.fuoriListinoIgnorati !== report.boxFuoriListino.filter((box) => box.ignorato).length ||
    new Set(report.boxFuoriListino.map((box) => box.codiceBox)).size !== report.boxFuoriListino.length ||
    report.boxFuoriListino.some((box) => box.ignorato ? box.referenze.length !== 0 : box.referenze.length === 0) ||
    compilati.some((box) => refs.filter((ref) => String(ref.groupId) === box.codiceBox).length !== box.referenze.length)
  ) {
    throw new BadRequestError({ message: 'Il report del plugin non e coerente con le referenze finali' });
  }
  return { refs: refs as SyncJsonPluginRef[], report };
}
