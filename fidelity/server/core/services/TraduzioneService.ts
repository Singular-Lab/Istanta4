import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../config/percorsi';
import { ITraduzioneService } from '../interfaces/ITraduzioneService';
import { log } from '../logger';

/**
 * Cartelle in cui cercare le traduzioni, in ordine. L'immagine Docker contiene solo
 * la build del client (dist/client/locales, copiata da Vite); in sviluppo e con PM2
 * c'e' anche il sorgente public/locales.
 */
const CARTELLE_LOCALES = [
  path.join(PROJECT_ROOT, 'dist', 'client', 'locales'),
  path.join(PROJECT_ROOT, 'public', 'locales'),
];

export class TraduzioneService implements ITraduzioneService {
  constructor(private readonly cartelle: string[] = CARTELLE_LOCALES) { }

  /**
   * Restituisce le traduzioni di una lingua e di un namespace, o un oggetto vuoto se
   * non esistono. i18next chiede la sola lingua ("it"): se manca la cartella esatta si
   * usa la prima variante regionale disponibile ("it-IT").
   */
  async getTraduzioni(language: string, namespace: string): Promise<Record<string, unknown>> {
    for (const cartella of this.cartelle) {
      const lingua = this.risolviLingua(cartella, language);
      if (!lingua) continue;
      const file = path.join(cartella, lingua, `${namespace}.json`);
      if (!fs.existsSync(file)) continue;
      return JSON.parse(await fs.promises.readFile(file, 'utf8'));
    }
    log.info('File di traduzione non trovato', { language, namespace });
    return {};
  }

  private risolviLingua(cartella: string, language: string): string | undefined {
    if (fs.existsSync(path.join(cartella, language))) return language;
    if (!fs.existsSync(cartella)) return undefined;
    const prefisso = `${language.toLowerCase()}-`;
    return fs.readdirSync(cartella)
      .sort()
      .find(nome => nome.toLowerCase().startsWith(prefisso) && fs.statSync(path.join(cartella, nome)).isDirectory());
  }
}
