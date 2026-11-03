import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IUserService } from '../../../interfaces/IUserService';
import { DefaultAgenziaLib } from '../../default/index.js';
import { loadAgenziaLib } from '../../loader.js';
import type { IAgenziaLib } from '../../types.js';
import { ConadcnoAgenziaLib } from '../index.js';

const cliente = vi.hoisted(() => ({ id: undefined as string | undefined }));
vi.mock('../../../config/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../config/index.js')>();
  return { ...original, default: { ...original.default, get CLIENT_ID() { return cliente.id; } } };
});

afterEach(() => { cliente.id = undefined; });

describe('ConadcnoAgenziaLib: import finale del plugin', () => {
  it("abilita l'import storico senza un adapter di confronto, il default no", () => {
    const userService = {} as IUserService;
    const agenzia = new ConadcnoAgenziaLib(userService);
    expect(agenzia.supportaImportStorico).toBe(true);
    expect(agenzia).not.toHaveProperty('storicoVolantino');
    expect((new DefaultAgenziaLib(userService) as IAgenziaLib).supportaImportStorico).toBeUndefined();
  });
  it.each(['conadcno', 'CONADCNO'])('il caricatore abilita l’import per il cliente %s senza adapter di confronto', async (id) => {
    cliente.id = id;
    const agenzia = await loadAgenziaLib({} as IUserService);
    expect(agenzia).toBeInstanceOf(ConadcnoAgenziaLib);
    expect(agenzia.supportaImportStorico).toBe(true);
    expect(agenzia).not.toHaveProperty('storicoVolantino');
  });
  it.each([undefined, 'default', 'cliente-non-configurato'])('il caricatore non abilita l’import per il cliente %s', async (id) => {
    cliente.id = id;
    const agenzia = await loadAgenziaLib({} as IUserService);
    expect(agenzia).toBeInstanceOf(DefaultAgenziaLib);
    expect(agenzia.supportaImportStorico).not.toBe(true);
  });
});
