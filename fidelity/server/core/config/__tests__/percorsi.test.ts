import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('cartelle del server', () => {
  it('la root del progetto e quella che contiene server/core/config, qualunque sia il cwd', async () => {
    const altrove = fs.mkdtempSync(path.join(os.tmpdir(), 'fidelity-cwd-'));
    try {
      vi.spyOn(process, 'cwd').mockReturnValue(altrove);
      const { PROJECT_ROOT } = await import('../percorsi');

      expect(PROJECT_ROOT).toBe(path.resolve(__dirname, '../../../..'));
      expect(fs.existsSync(path.join(PROJECT_ROOT, 'server/core/config/percorsi.ts'))).toBe(true);
    } finally {
      fs.rmSync(altrove, { recursive: true, force: true });
    }
  });

  it('i temporanei degli upload stanno sotto uploads/ e fuori da public/', async () => {
    const { PROJECT_ROOT, UPLOAD_TMP_DIR } = await import('../percorsi');

    expect(UPLOAD_TMP_DIR).toBe(path.join(PROJECT_ROOT, 'uploads', 'tmp'));
    expect(path.relative(path.join(PROJECT_ROOT, 'public'), UPLOAD_TMP_DIR).startsWith('..')).toBe(true);
  });
});
