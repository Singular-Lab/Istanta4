import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import AdmZip = require('adm-zip');

/*
 * Olimpo usa adm-zip in due punti: uploadPacchettoFoto estrae il pacchetto
 * ricevuto con extractAllTo (sovrascrivendo i file con lo stesso nome) e il
 * download multiplo dei materiali crea lo zip con addLocalFile e
 * writeZipPromise. Questi test fissano quel comportamento, cosi' un
 * aggiornamento della libreria che lo cambiasse viene notato, e verificano che
 * una voce del pacchetto non possa scrivere fuori dalla cartella di estrazione.
 */
describe('pacchetti zip', () => {
  let cartellaTest: string;
  let destinazione: string;

  beforeEach(async () => {
    cartellaTest = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'olimpo-zip-test-'));
    destinazione = path.join(cartellaTest, 'estrazione');
    await fs.promises.mkdir(destinazione);
  });

  afterEach(async () => {
    await fs.promises.rm(cartellaTest, { recursive: true, force: true });
    expect(fs.existsSync(cartellaTest)).toBe(false);
  });

  it('estrae le foto del pacchetto nella cartella di estrazione, sovrascrivendo quelle con lo stesso nome', () => {
    const foto1 = Buffer.from('contenuto della prima foto');
    const foto2 = Buffer.from('contenuto della seconda foto');
    fs.writeFileSync(path.join(destinazione, 'foto1.jpg'), 'versione precedente');

    const pacchetto = new AdmZip();
    pacchetto.addFile('foto1.jpg', foto1);
    pacchetto.addFile('foto2.png', foto2);
    const percorsoZip = path.join(cartellaTest, 'pacchetto.zip');
    fs.writeFileSync(percorsoZip, pacchetto.toBuffer());

    new AdmZip(percorsoZip).extractAllTo(destinazione, true);

    expect(fs.readdirSync(destinazione).sort()).toEqual(['foto1.jpg', 'foto2.png']);
    expect(fs.readFileSync(path.join(destinazione, 'foto1.jpg'))).toEqual(foto1);
    expect(fs.readFileSync(path.join(destinazione, 'foto2.png'))).toEqual(foto2);
  });

  it('crea con addLocalFile e writeZipPromise uno zip che contiene i file indicati', async () => {
    const materiale1 = path.join(cartellaTest, 'materiale1.pdf');
    const materiale2 = path.join(cartellaTest, 'materiale2.pdf');
    fs.writeFileSync(materiale1, '%PDF-1.4 primo');
    fs.writeFileSync(materiale2, '%PDF-1.4 secondo');

    const zip = new AdmZip();
    zip.addLocalFile(materiale1);
    zip.addLocalFile(materiale2);
    const percorsoZip = path.join(cartellaTest, 'materiali.zip');
    await zip.writeZipPromise(percorsoZip);

    const riletto = new AdmZip(percorsoZip);
    const voci = riletto.getEntries().map((voce) => voce.entryName).sort();
    expect(voci).toEqual(['materiale1.pdf', 'materiale2.pdf']);
    expect(riletto.readAsText('materiale1.pdf')).toBe('%PDF-1.4 primo');
    expect(riletto.readAsText('materiale2.pdf')).toBe('%PDF-1.4 secondo');
  });

  it('non scrive fuori dalla cartella di estrazione una voce con ../ nel nome', () => {
    // Il nome va forzato nei byte dello zip: stessa lunghezza, quindi le
    // intestazioni restano coerenti.
    const pacchetto = new AdmZip();
    pacchetto.addFile('aa/fuori.jpg', Buffer.from('foto malevola'));
    const byte = pacchetto.toBuffer();
    const nomeOriginale = Buffer.from('aa/fuori.jpg');
    const nomeMalevolo = Buffer.from('../fuori.jpg');
    let posizione = byte.indexOf(nomeOriginale);
    expect(posizione).toBeGreaterThanOrEqual(0);
    while (posizione >= 0) {
      nomeMalevolo.copy(byte, posizione);
      posizione = byte.indexOf(nomeOriginale, posizione + nomeMalevolo.length);
    }
    const percorsoZip = path.join(cartellaTest, 'malevolo.zip');
    fs.writeFileSync(percorsoZip, byte);

    try {
      new AdmZip(percorsoZip).extractAllTo(destinazione, true);
    } catch {
      // Anche rifiutare il pacchetto va bene: conta che non esca dalla cartella.
    }

    expect(fs.existsSync(path.join(cartellaTest, 'fuori.jpg'))).toBe(false);
    expect(fs.readdirSync(cartellaTest).sort()).toEqual(['estrazione', 'malevolo.zip']);
  });
});
