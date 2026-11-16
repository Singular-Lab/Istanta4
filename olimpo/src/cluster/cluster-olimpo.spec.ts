import { avviaPrimary, numeroWorker, ritardoRiavvioMs, VITA_STABILE_MS, type AmbienteCluster, type WorkerOlimpo } from './cluster-olimpo';

/*
 * I processi di Olimpo in produzione (spec olimpo/processi-in-produzione): quanti, avviati uno alla
 * volta, riavviati con un'attesa crescente, nessun riavvio in chiusura. Un ambiente finto sostituisce
 * il modulo cluster, i segnali, i timer e il tempo.
 */

interface WorkerFinto extends WorkerOlimpo {
  indice: string;
  segnali: string[];
  pronto(): void;
}

const ambienteFinto = () => {
  const forkati: WorkerFinto[] = [];
  const timer: Array<{ ms: number; azione: () => void }> = [];
  const segnali = new Map<string, () => void>();
  const righe: string[] = [];
  const stato = { adesso: 0, codiceUscita: null as number | null };
  let suUscita: (worker: WorkerOlimpo, codice: number | null, segnale: string | null) => void = () => undefined;

  const amb: AmbienteCluster = {
    fork: (env) => {
      let ascolta: () => void = () => undefined;
      const worker: WorkerFinto = {
        id: forkati.length + 1,
        indice: env.OLIMPO_WORKER_INDEX,
        segnali: [],
        process: { pid: 1000 + forkati.length + 1, kill: (s) => void worker.segnali.push(String(s)) },
        once: (_evento, f) => (ascolta = f),
        pronto: () => ascolta(),
      };
      forkati.push(worker);
      return worker;
    },
    suUscita: (f) => (suUscita = f),
    suSegnale: (s, f) => void segnali.set(s, f),
    esci: (codice) => (stato.codiceUscita = codice),
    ora: () => stato.adesso,
    attendi: (ms, azione) => void timer.push({ ms, azione }),
    log: (m) => void righe.push(m),
    errore: (m) => void righe.push(`ERRORE ${m}`),
  };

  /** Esegue i timer in attesa, nell'ordine in cui sono stati messi. */
  const scadonoTimer = () => timer.splice(0).forEach((t) => t.azione());
  const termina = (worker: WorkerFinto, codice: number | null = 1, segnale: string | null = null) => suUscita(worker, codice, segnale);
  return { amb, forkati, timer, segnali, righe, stato, scadonoTimer, termina };
};

describe('numero di processi di Olimpo in produzione', () => {
  it('sono 2 se OLIMPO_WORKERS manca o non e\' valida, anche con molte CPU', () => {
    expect(numeroWorker(32, {})).toBe(2);
    expect(numeroWorker(32, { OLIMPO_WORKERS: 'tanti' })).toBe(2);
    expect(numeroWorker(32, { OLIMPO_WORKERS: '0' })).toBe(2);
    expect(numeroWorker(32, { OLIMPO_WORKERS: '-3' })).toBe(2);
  });

  it('seguono OLIMPO_WORKERS, ma mai piu\' delle CPU disponibili e mai meno di uno', () => {
    expect(numeroWorker(8, { OLIMPO_WORKERS: '4' })).toBe(4);
    expect(numeroWorker(2, { OLIMPO_WORKERS: '8' })).toBe(2);
    expect(numeroWorker(1, {})).toBe(1);
  });

  it('l\'attesa prima di un riavvio raddoppia da 1 s fino a 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 10].map(ritardoRiavvioMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

describe('primary di Olimpo', () => {
  it('avvia i processi uno alla volta: il successivo solo quando il precedente e\' pronto', () => {
    const f = ambienteFinto();

    avviaPrimary(f.amb, 3, {});
    expect(f.forkati.map((w) => w.indice)).toEqual(['1']);

    f.forkati[0].pronto();
    expect(f.forkati.map((w) => w.indice)).toEqual(['1', '2']);
    f.forkati[1].pronto();
    expect(f.forkati.map((w) => w.indice)).toEqual(['1', '2', '3']);
    f.forkati[2].pronto();
    expect(f.forkati).toHaveLength(3);
    expect(f.righe[0]).toContain('3 processi');
  });

  it('un processo che muore all\'avvio non blocca i successivi e torna con un\'attesa crescente', () => {
    const f = ambienteFinto();
    avviaPrimary(f.amb, 2, {});

    // Il processo 1 muore prima di essere pronto: parte subito il 2, il riavvio dell'1 aspetta 1 s
    f.termina(f.forkati[0]);
    expect(f.forkati.map((w) => w.indice)).toEqual(['1', '2']);
    expect(f.timer.map((t) => t.ms)).toEqual([1000]);
    expect(f.righe.some((r) => r.startsWith('ERRORE Processo 1') && r.includes('codice 1') && r.includes('riavvio tra 1000 ms'))).toBe(true);

    // Scaduta l'attesa, l'1 aspetta che il 2 sia pronto
    f.scadonoTimer();
    expect(f.forkati).toHaveLength(2);
    f.forkati[1].pronto();
    expect(f.forkati.map((w) => w.indice)).toEqual(['1', '2', '1']);

    // Muore ancora: 2 s, poi 4 s
    f.termina(f.forkati[2]);
    expect(f.timer.map((t) => t.ms)).toEqual([2000]);
    f.scadonoTimer();
    f.termina(f.forkati[3]);
    expect(f.timer.map((t) => t.ms)).toEqual([4000]);
  });

  it('dopo un minuto di vita l\'attesa torna a 1 s', () => {
    const f = ambienteFinto();
    avviaPrimary(f.amb, 1, {});
    f.termina(f.forkati[0]);
    f.scadonoTimer();
    f.forkati[1].pronto();

    f.stato.adesso += VITA_STABILE_MS;
    f.termina(f.forkati[1], null, 'SIGKILL');

    expect(f.timer.map((t) => t.ms)).toEqual([1000]);
    expect(f.righe.some((r) => r.includes('segnale SIGKILL'))).toBe(true);
  });

  it('in chiusura inoltra il segnale ai processi, non li riavvia ed esce quando sono terminati', () => {
    const f = ambienteFinto();
    avviaPrimary(f.amb, 2, {});
    f.forkati[0].pronto();
    f.forkati[1].pronto();

    f.segnali.get('SIGTERM')!();
    expect(f.forkati.map((w) => w.segnali)).toEqual([['SIGTERM'], ['SIGTERM']]);

    f.termina(f.forkati[0], 0);
    expect(f.stato.codiceUscita).toBeNull();
    f.termina(f.forkati[1], 0);
    expect(f.stato.codiceUscita).toBe(0);
    expect(f.forkati).toHaveLength(2);
  });

  it('un riavvio in attesa non parte se nel frattempo e\' iniziata la chiusura', () => {
    const f = ambienteFinto();
    avviaPrimary(f.amb, 2, {});
    f.forkati[0].pronto();
    f.forkati[1].pronto();
    f.termina(f.forkati[0]);

    f.segnali.get('SIGTERM')!();
    f.timer.filter((t) => t.ms === 1000).forEach((t) => t.azione());

    expect(f.forkati).toHaveLength(2);
  });
});
