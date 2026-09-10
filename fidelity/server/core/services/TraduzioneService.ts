import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseError } from '../../../lib/errors';
import { ITraduzioneService } from '../interfaces/ITraduzioneService';
import { log } from '../logger';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class TraduzioneService implements ITraduzioneService {
  async getTraduzioni(language: string, namespace: string): Promise<any> {
    try {
      const traduzioni = await fs.promises.readFile(
        path.join(__dirname, `../../../public/locales/${language}/${namespace}.json`),
        'utf8'
      );
      return JSON.parse(traduzioni);
    } catch (error) {
      log.error('Impossibile leggere il file di traduzioni dal filesystem', error instanceof Error ? error : new Error(String(error)), { language, namespace });
      throw new DatabaseError({
        message: 'Errore durante il recupero delle traduzioni',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
