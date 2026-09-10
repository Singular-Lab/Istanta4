#!/usr/bin/env node

import { initializeDatabase } from '../db';
import { TracciatiMomento } from '../models/tracciati_momento';
import { TracciatiMomentoConfronti } from '../models/tracciati_momento_confronti';
import { TracciatiReport } from '../models/tracciati_report';
import { program } from 'commander';
import { Colorize } from '../../../lib/Colorize';

program
  .name('migrate-momenti-linear')
  .description(
    'Per ogni confronto tra momenti: mantiene solo quelli tra momenti adiacenti (tipo=lineare) ' +
    'ed elimina i non adiacenti. Cancella anche tutti i report e i widget salvati.'
  )
  .version('1.0.0')
  .option('--dry-run', 'Mostra le modifiche senza applicarle')
  .action(async (options) => {
    const isDryRun: boolean = !!options.dryRun;

    try {
      console.log(Colorize.bgBlue('Avvio migrazione momenti → confronti lineari...'));
      if (isDryRun) console.log(Colorize.bgYellow('[DRY RUN] Nessuna modifica verrà applicata'));

      await initializeDatabase();

      // ── 1. Processa i confronti ───────────────────────────────────────────
      const confronti = await TracciatiMomentoConfronti.findAll();
      const momenti = await TracciatiMomento.findAll({
        attributes: ['id', 'ordine'] as any,
      });
      const ordineByMomentoId = new Map<any, number>();
      for (const momento of momenti) {
        ordineByMomentoId.set((momento as any).id, (momento as any).ordine ?? 0);
      }
      console.log(`\nConfronti trovati: ${confronti.length}`);

      let kept = 0;
      let deleted = 0;
      let orphan = 0;

      for (const c of confronti) {
        const primarioId = (c as any).primario;
        const secondarioId = (c as any).secondario;
        const hasMomA = ordineByMomentoId.has(primarioId);
        const hasMomB = ordineByMomentoId.has(secondarioId);

        if (!hasMomA || !hasMomB) {
          console.log(
            Colorize.bgRed(
              `  [ORFANO] confronto ${(c as any).id} — momento non trovato (primario=${primarioId}, secondario=${secondarioId})`
            )
          );
          if (!isDryRun) await (c as any).destroy();
          orphan++;
          deleted++;
          continue;
        }

        const ordineA: number = ordineByMomentoId.get(primarioId) ?? 0;
        const ordineB: number = ordineByMomentoId.get(secondarioId) ?? 0;
        const isAdjacent = Math.abs(ordineA - ordineB) === 1;

        if (isAdjacent) {
          console.log(
            `  [MANTIENI] confronto ${(c as any).id} — momenti adiacenti (ordine ${ordineA} ↔ ${ordineB})`
          );
          if (!isDryRun) {
            await TracciatiMomentoConfronti.update(
              { tipo: 'lineare', report: null } as any,
              { where: { id: (c as any).id } as any }
            );
          }
          kept++;
        } else {
          console.log(
            `  [ELIMINA]  confronto ${(c as any).id} — momenti non adiacenti (ordine ${ordineA} ↔ ${ordineB})`
          );
          if (!isDryRun) await (c as any).destroy();
          deleted++;
        }
      }

      // ── 2. Pulisci confronti_ids sui momenti (rimuovi link non adiacenti) ─
      if (!isDryRun) {
        const momenti = await TracciatiMomento.findAll();
        for (const m of momenti) {
          const confrontiIds: string[] = (m as any).confronti_ids ?? [];
          if (confrontiIds.length > 0) {
            await TracciatiMomento.update(
              { confronti_ids: [], updatedat: new Date() } as any,
              { where: { id: (m as any).id } as any }
            );
          }
        }
        console.log('\nconfronti_ids puliti su tutti i momenti.');
      }

      // ── 3. Elimina tutti i record TracciatiReport ─────────────────────────
      const reportCount = await TracciatiReport.count();
      console.log(`\nReport salvati trovati: ${reportCount}`);
      if (!isDryRun && reportCount > 0) {
        await TracciatiReport.destroy({ where: {} as any, truncate: true });
      }

      // ── Riepilogo ─────────────────────────────────────────────────────────
      console.log('');
      console.log(Colorize.bgGreen('─── Riepilogo ───────────────────────────────────'));
      console.log(`  Confronti mantenuti (lineari):        ${kept}`);
      console.log(`  Confronti eliminati (non adiacenti):  ${deleted - orphan}`);
      console.log(`  Confronti eliminati (orfani):         ${orphan}`);
      console.log(`  Report eliminati:                     ${reportCount}`);
      if (isDryRun) console.log(Colorize.bgYellow('\n[DRY RUN] Nessuna modifica applicata'));
      else console.log(Colorize.bgGreen('\nMigrazione completata con successo'));

      process.exit(0);
    } catch (error) {
      console.error(Colorize.bgRed('Errore durante la migrazione:'), error);
      process.exit(1);
    }
  });

program.parse();
