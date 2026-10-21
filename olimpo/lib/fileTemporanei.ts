import * as os from 'os';
import * as path from 'path';

/**
 * Percorso di un file temporaneo di lavoro (zip o foto appena ricevuti).
 * Sta nella cartella temporanea del sistema e non nella cartella dell'applicazione:
 * nel container Olimpo gira come utente `node` e /app appartiene a root.
 * os.tmpdir() rispetta la variabile TMPDIR.
 */
export function percorsoFileTemporaneo(nome: string): string {
  if (!nome || nome !== path.basename(nome) || nome === '.' || nome === '..') {
    throw new Error(`Nome di file temporaneo non valido: ${nome}`);
  }
  return path.join(os.tmpdir(), nome);
}
