import { BadRequestError } from '../../../lib/errors';
import type { OrigineStorico } from '../../../lib/types';
import type { SyncJsonPluginPayload, SyncJsonPluginRef } from '../agenzia_lib/types';

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
