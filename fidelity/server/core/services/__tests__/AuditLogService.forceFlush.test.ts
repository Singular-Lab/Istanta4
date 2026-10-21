import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AuditEventType, AuditLogService } from '../AuditLogService';

describe('AuditLogService.forceFlush allo shutdown', () => {
  it('si risolve solo quando tutte le scritture su DB sono concluse, anche quelle gia avviate', async () => {
    const completa: Array<() => void> = [];
    const bulkInsert = vi.fn(() => new Promise<void>((resolve) => { completa.push(resolve); }));
    const audit = AuditLogService.getInstance();
    audit.setRepository({ bulkInsert } as any);

    // Evento critico: scrittura avviata subito, prima dello shutdown
    audit.logEvent(AuditEventType.SECURITY_VIOLATION);
    // Evento ordinario: ancora nel buffer
    audit.logEvent(AuditEventType.LOGOUT);

    let svuotato = false;
    const flush = audit.forceFlush().then(() => { svuotato = true; });
    await new Promise((r) => setTimeout(r, 0));

    expect(bulkInsert).toHaveBeenCalledTimes(2);
    expect(svuotato).toBe(false);

    completa[1]();
    await new Promise((r) => setTimeout(r, 0));
    expect(svuotato).toBe(false);

    completa[0]();
    await flush;
    expect(svuotato).toBe(true);
  });
});
