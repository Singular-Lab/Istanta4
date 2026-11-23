import { afterEach, describe, expect, it } from 'vitest';
import { eseguiMisurando, intestazioneServerTiming, misura, sogliaRichiestaLentaMs } from '../tempiRichiesta';

describe('tempiRichiesta', () => {
  afterEach(() => {
    delete process.env.FIDELITY_SOGLIA_RICHIESTA_LENTA_MS;
  });

  it('registra le fasi misurate dentro una richiesta e il totale', async () => {
    const { valore, voci, totaleMs } = await eseguiMisurando(async () => {
      const a = await misura('query', async () => 1);
      const b = await misura('calcolo', async () => 2);
      return a + b;
    });

    expect(valore).toBe(3);
    expect(voci.map(v => v.nome)).toEqual(['query', 'calcolo']);
    expect(voci.every(v => v.ms >= 0)).toBe(true);
    expect(totaleMs).toBeGreaterThanOrEqual(0);
  });

  it('fuori da una richiesta misurata esegue il lavoro e basta', async () => {
    await expect(misura('query', async () => 'ok')).resolves.toBe('ok');
  });

  it('un errore nel lavoro misurato arriva a chi ha chiamato', async () => {
    await expect(
      eseguiMisurando(async () => misura('query', async () => {
        throw new Error('guasto');
      }))
    ).rejects.toThrow('guasto');
  });

  it('tiene separate due richieste che girano insieme', async () => {
    const [a, b] = await Promise.all([
      eseguiMisurando(async () => {
        await misura('solo-a', async () => new Promise(risolvi => setTimeout(risolvi, 5)));
      }),
      eseguiMisurando(async () => {
        await misura('solo-b', async () => undefined);
      }),
    ]);

    expect(a.voci.map(v => v.nome)).toEqual(['solo-a']);
    expect(b.voci.map(v => v.nome)).toEqual(['solo-b']);
  });

  it('scrive l\'intestazione Server-Timing con nomi ammessi e il totale', () => {
    expect(intestazioneServerTiming([{ nome: 'insight kit', ms: 12.5 }, { nome: 'query', ms: 3 }], 20.1))
      .toBe('insight_kit;dur=12.5, query;dur=3, totale;dur=20.1');
  });

  it('la soglia delle richieste lente e\' 1000 ms, o quella configurata se valida', () => {
    expect(sogliaRichiestaLentaMs()).toBe(1000);
    process.env.FIDELITY_SOGLIA_RICHIESTA_LENTA_MS = '250';
    expect(sogliaRichiestaLentaMs()).toBe(250);
    process.env.FIDELITY_SOGLIA_RICHIESTA_LENTA_MS = 'abc';
    expect(sogliaRichiestaLentaMs()).toBe(1000);
  });
});
