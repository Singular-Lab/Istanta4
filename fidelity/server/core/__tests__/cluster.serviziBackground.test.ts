import { afterEach, describe, expect, it, vi } from 'vitest';

const chron = vi.hoisted(() => ({ startAllJobs: vi.fn() }));

vi.mock('../services/ChronService', () => ({
  ChronService: class {
    startAllJobs = chron.startAllJobs;
  },
}));

vi.mock('../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ritardoRiavvioMs } from '../cluster';
import { initializeBackgroundServices } from '../services/startup';

afterEach(() => {
  chron.startAllJobs.mockClear();
  vi.unstubAllEnvs();
});

// Cron promo, pulizie e coda WhatsApp devono girare in un solo processo del cluster
describe('servizi di background nel cluster', () => {
  it('nel worker 2 non partono', () => {
    vi.stubEnv('WORKER_INDEX', '2');

    initializeBackgroundServices();

    expect(chron.startAllJobs).not.toHaveBeenCalled();
  });

  it.each([['1'], [undefined]])('con WORKER_INDEX=%s (worker 1 o senza cluster) partono', (indice) => {
    vi.stubEnv('WORKER_INDEX', indice);

    initializeBackgroundServices();

    expect(chron.startAllJobs).toHaveBeenCalledTimes(1);
  });
});

describe('ritardo prima di riforkare un worker', () => {
  it('raddoppia a ogni crash ravvicinato e non supera 30 s', () => {
    expect([0, 1, 2, 4, 5, 10].map((n) => ritardoRiavvioMs(n))).toEqual([1000, 2000, 4000, 16000, 30000, 30000]);
  });
});
