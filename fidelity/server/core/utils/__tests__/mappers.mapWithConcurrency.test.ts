import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../mappers';

// Prima, dopo ogni Promise.race toglieva dalla coda l'ultima promessa aggiunta invece di quella
// finita: il limite non era rispettato e i risultati uscivano nell'ordine di completamento.
describe('mapWithConcurrency', () => {
  const attendi = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  it('non supera il limite di chiamate contemporanee', async () => {
    let inCorso = 0;
    let massimo = 0;
    const durate = [30, 5, 5, 5, 5, 30, 5, 5];

    await mapWithConcurrency(durate, async ms => {
      inCorso++;
      massimo = Math.max(massimo, inCorso);
      await attendi(ms);
      inCorso--;
      return ms;
    }, 2);

    expect(massimo).toBe(2);
  });

  it('restituisce i risultati nell\'ordine delle entita\', non in quello di completamento', async () => {
    const risultati = await mapWithConcurrency([20, 1, 10], async ms => {
      await attendi(ms);
      return `fatto ${ms}`;
    }, 3);

    expect(risultati).toEqual(['fatto 20', 'fatto 1', 'fatto 10']);
  });

  it('con una lista vuota restituisce una lista vuota', async () => {
    expect(await mapWithConcurrency([], async x => x)).toEqual([]);
  });
});
