import { riscriviUrlOlimpo } from '../utils/urlOlimpo';

/** Riga di files_runtime letta dalla migrazione degli URL Olimpo. */
export interface RigaUrlFileRuntime {
  id: string;
  url?: string | null;
  id_olimpo_cloud?: string | null;
}

export interface PianoUrlFilesRuntime {
  /** Nuovo valore di url per ogni riga da cambiare: null per le righe da azzerare. */
  aggiornamenti: Array<{ id: string; url: string | null }>;
  azzerati: number;
  riscritti: number;
}

/**
 * Cosa fare di files_runtime.url, senza toccare il DB (lo usa migrateOlimpoUrls, anche in dry-run).
 * Con l'id Olimpo l'URL si ricostruisce alla lettura: quello salvato si azzera, perche' conserverebbe
 * l'id superato da una sostituzione del file. Senza id resta l'unico riferimento: si riscrive in forma
 * relativa al proxy, come nelle altre tabelle, e un URL che non e' di Olimpo resta com'e'.
 */
export function pianificaUrlFilesRuntime(righe: RigaUrlFileRuntime[]): PianoUrlFilesRuntime {
  const piano: PianoUrlFilesRuntime = { aggiornamenti: [], azzerati: 0, riscritti: 0 };
  for (const riga of righe) {
    if (!riga.url) continue;
    if (riga.id_olimpo_cloud && riga.id_olimpo_cloud.trim() !== '') {
      piano.aggiornamenti.push({ id: riga.id, url: null });
      piano.azzerati++;
      continue;
    }
    const { valore, modifiche } = riscriviUrlOlimpo(riga.url);
    if (modifiche === 0) continue;
    piano.aggiornamenti.push({ id: riga.id, url: valore });
    piano.riscritti++;
  }
  return piano;
}
