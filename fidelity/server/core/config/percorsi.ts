import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Cartelle su disco usate dal server.
 *
 * Sono ricavate dalla posizione di questo file (server/core/config -> root del
 * progetto) e non da process.cwd(): il server scrive sempre negli stessi posti,
 * da qualunque cartella venga avviato (PM2, Docker, test).
 */
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Radice degli upload: in Docker e' il volume montato su /app/uploads. */
export const UPLOAD_DIR = path.join(PROJECT_ROOT, 'uploads');

/**
 * File caricati in attesa di elaborazione o di inoltro a Olimpo. Non e' servita
 * via HTTP: ogni flusso rimuove il proprio temporaneo quando ha finito.
 */
export const UPLOAD_TMP_DIR = path.join(UPLOAD_DIR, 'tmp');
