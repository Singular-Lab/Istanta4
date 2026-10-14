import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { log } from '../../logger';
import { AuditEventType, AuditLogService } from '../AuditLogService';

describe('AuditLogService, eventi critici nei log', () => {
  it('scrive l\'evento senza un Error fittizio, quindi senza stack inutile', () => {
    const audit = AuditLogService.getInstance();
    audit.setRepository({ bulkInsert: vi.fn(async () => undefined) } as any);

    audit.logEvent(AuditEventType.SECURITY_VIOLATION);

    const [messaggio, errore, dati] = vi.mocked(log.error).mock.calls.find(([m]) => m === 'AUDIT: SECURITY_VIOLATION')!;
    expect(messaggio).toBe('AUDIT: SECURITY_VIOLATION');
    expect(errore).toBeUndefined();
    expect(dati).toMatchObject({ eventType: AuditEventType.SECURITY_VIOLATION, severity: 'CRITICAL' });
  });
});
