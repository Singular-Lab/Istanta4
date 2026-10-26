import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { percorsoFileTemporaneo } from '@lib/fileTemporanei';

/*
 * Gli upload di foto (uploadPacchettoFoto, uploadFoto, uploadFotoWebPliant)
 * scrivevano il file ricevuto nella radice dell'applicazione: nel container
 * Olimpo gira come `node` e /app e' di root, quindi la scrittura falliva con
 * EACCES e l'upload rispondeva 500. I temporanei devono stare nella cartella
 * temporanea del sistema.
 */
describe('percorsoFileTemporaneo', () => {
  let cartellaTest: string;

  beforeEach(async () => {
    cartellaTest = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-tmp-test-'));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await fs.promises.rm(cartellaTest, { recursive: true, force: true });
  });

  it('restituisce un percorso scrivibile nella cartella temporanea, fuori dalla radice dell app', async () => {
    // Jest isola process.env del test: TMPDIR qui non arriverebbe a os.tmpdir().
    jest.spyOn(os, 'tmpdir').mockReturnValue(cartellaTest);
    const radiceApp = path.resolve(__dirname, '..');

    const percorso = percorsoFileTemporaneo('foto-prova.zip');

    expect(percorso).toBe(path.join(cartellaTest, 'foto-prova.zip'));
    expect(path.relative(radiceApp, percorso).startsWith('..')).toBe(true);
    await fs.promises.writeFile(percorso, Buffer.from('zip'));
    expect(fs.existsSync(percorso)).toBe(true);
    await fs.promises.rm(percorso);
    expect(fs.readdirSync(cartellaTest)).toEqual([]);
  });

  it.each(['', '.', '..', '../foto.zip', 'sotto/foto.zip', '/etc/passwd'])(
    'rifiuta il nome %p che uscirebbe dalla cartella temporanea',
    (nome) => {
      expect(() => percorsoFileTemporaneo(nome)).toThrow('Nome di file temporaneo non valido');
    },
  );
});
