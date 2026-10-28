import { describe, expect, it, vi } from 'vitest';

const createTransport = vi.hoisted(() => vi.fn(() => ({ sendMail: vi.fn() })));
vi.mock('nodemailer', () => ({ default: { createTransport }, createTransport }));

vi.mock('../../middleware/rateLimiter', () => ({
  passwordResetRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { EmailController } from '../EmailController';

describe('trasporto SMTP del recupero password', () => {
  it('ha tempi massimi espliciti: 10 s per connessione e saluto, 30 s di inattivita\'', () => {
    new EmailController({} as any);

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    }));
  });
});
