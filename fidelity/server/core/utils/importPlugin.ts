import { z } from 'zod';
import { BadRequestError } from '../../../lib/errors';
import type { OrigineStorico } from '../../../lib/types';
import type { SyncJsonPluginPayload, SyncJsonPluginRef } from '../agenzia_lib/types';

const posizione = {
  pag: z.number().int().nonnegative().optional(),
  x: z.number().optional(), y: z.number().optional(),
  w: z.number().nonnegative().optional(), h: z.number().nonnegative().optional(),
  wPage: z.number().positive().optional(), hPage: z.number().positive().optional(),
  percIngombro: z.number().nonnegative().optional(), aspectRatio: z.number().nonnegative().optional(),
};
const referenzaReport = z.object({
  codice: z.string(), descrizione: z.string(),
  campi: z.array(z.object({ label: z.string(), valore: z.string() }).strict()),
}).strict();
const importFinale = z.object({
  versioneImport: z.literal(1),
  refs: z.array(z.object({
    groupId: z.union([z.string().min(1), z.number().int()]),
    dna: z.string().optional(), meccanica: z.string().optional(),
    dataFields: z.record(z.string(), z.unknown()),
    groupElements: z.array(z.record(z.string(), z.unknown())).optional(),
    foto: z.array(z.object({ nome: z.string().min(1), guidId: z.string().min(1).optional() }).strict()),
    compiledFields: z.array(z.object({
      labelName: z.string().optional(), paragraphName: z.string().optional(),
      content: z.union([z.string(), z.number()]).optional(),
    }).strict()).optional(),
    ...posizione,
  }).strict()),
  reportStorico: z.object({
    boxNelVolantino: z.number().int().nonnegative(),
    referenzeDaListino: z.number().int().nonnegative(),
    nonImpaginate: z.array(referenzaReport),
    lasciapassareNonImpaginate: z.boolean(),
    totaleFuoriListino: z.number().int().nonnegative(),
    fuoriListinoIgnorati: z.number().int().nonnegative(),
    boxFuoriListino: z.array(z.object({
      codiceBox: z.string().min(1), pag: posizione.pag,
      ignorato: z.boolean(), testoBox: z.array(z.string()), referenze: z.array(referenzaReport),
    }).strict()),
  }).strict(),
});

export function validaImportFinale(payload: SyncJsonPluginPayload): {
  refs: SyncJsonPluginRef[];
  report: Omit<OrigineStorico, 'importatoIl' | 'nomeFile'>;
} {
  const parsed = importFinale.safeParse(payload);
  if (!parsed.success) {
    throw new BadRequestError({ message: 'Import finale del plugin non valido: aggiornare il plugin e completare la preparazione locale' });
  }
  const { refs, reportStorico: report } = parsed.data;
  const compilati = report.boxFuoriListino.filter((box) => !box.ignorato);
  const totaleCompilati = compilati.reduce((totale, box) => totale + box.referenze.length, 0);
  if (
    report.nonImpaginate.length > 0 && !report.lasciapassareNonImpaginate ||
    report.referenzeDaListino + totaleCompilati !== refs.length ||
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