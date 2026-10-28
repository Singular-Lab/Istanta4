import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerCall } from '../server_call';

// Una pagina protetta che si smontava lasciava in ServerCall una callback vuota: sulle pagine
// senza HOC un 401 non mostrava piu' l'avviso di sessione scaduta ne' portava al login.

const sessioneScaduta = () => (ServerCall as any).handleUnauthorized();

afterEach(() => {
  ServerCall.resetSessionExpiredFlag();
  (ServerCall as any).onUnauthorizedCallback = null;
});

describe('callback del 401 in ServerCall', () => {
  it('quando la pagina si smonta torna attiva la callback del layout', () => {
    const layout = vi.fn();
    const pagina = vi.fn();
    ServerCall.setOnUnauthorizedCallback(layout);
    const precedente = ServerCall.setOnUnauthorizedCallback(pagina);

    ServerCall.removeOnUnauthorizedCallback(pagina, precedente);
    sessioneScaduta();

    expect(layout).toHaveBeenCalledOnce();
    expect(pagina).not.toHaveBeenCalled();
  });

  it('non toglie la callback registrata nel frattempo da un\'altra pagina', () => {
    const layout = vi.fn();
    const vecchia = vi.fn();
    const nuova = vi.fn();
    ServerCall.setOnUnauthorizedCallback(layout);
    const precedente = ServerCall.setOnUnauthorizedCallback(vecchia);
    ServerCall.setOnUnauthorizedCallback(nuova);

    ServerCall.removeOnUnauthorizedCallback(vecchia, precedente);
    sessioneScaduta();

    expect(nuova).toHaveBeenCalledOnce();
    expect(layout).not.toHaveBeenCalled();
  });
});
