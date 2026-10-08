import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// multerConfig ricava le cartelle da process.cwd() al caricamento: lo puntiamo a
// una cartella temporanea per non scrivere nel repository.
let tmpRoot: string;
let materialiDir: string;
let upload: typeof import('../multerConfig').uploadMaterialiPubblicazioni;

beforeAll(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-multer-'));
  materialiDir = path.join(tmpRoot, 'public', 'uploads', 'materiali_POP');
  vi.spyOn(process, 'cwd').mockReturnValue(tmpRoot);
  ({ uploadMaterialiPubblicazioni: upload } = await import('../multerConfig'));
});

afterAll(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function createApp(received: Express.Multer.File[]) {
  const app = express();
  app.post('/upload', upload.single('file'), (req, res) => {
    received.push(req.file!);
    res.sendStatus(200);
  });
  return app;
}

describe('storage dei materiali pubblicazioni', () => {
  it('due file con lo stesso nome non si sovrascrivono e conservano il nome originale', async () => {
    const received: Express.Multer.File[] = [];
    const app = createApp(received);

    await request(app).post('/upload').attach('file', Buffer.from('primo'), 'materiale.pdf').expect(200);
    await request(app).post('/upload').attach('file', Buffer.from('secondo'), 'materiale.pdf').expect(200);

    expect(received.map(f => f.originalname)).toEqual(['materiale.pdf', 'materiale.pdf']);
    expect(received[0].filename).not.toBe(received[1].filename);
    expect(received.every(f => path.dirname(f.path) === materialiDir && f.filename.endsWith('.pdf'))).toBe(true);
    expect(fs.readFileSync(received[0].path, 'utf8')).toBe('primo');
    expect(fs.readFileSync(received[1].path, 'utf8')).toBe('secondo');
  });

  it('un nome file con un percorso non porta il file fuori dalla cartella', async () => {
    const received: Express.Multer.File[] = [];

    await request(createApp(received)).post('/upload').attach('file', Buffer.from('x'), '../../fuori.pdf').expect(200);

    expect(path.dirname(received[0].path)).toBe(materialiDir);
  });
});
