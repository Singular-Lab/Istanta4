import { describe, expect, it, vi } from 'vitest';
import { EVENTO_DISSINCRONIA, HEADER_DISSINCRONIA, segnalaDissincronia } from '../dissincronia';

// In development il server segnala con un header le scritture rimaste solo in FP

describe('segnalaDissincronia', () => {
  it('con l\'header emette l\'evento con l\'operazione di Istanta', () => {
    const bersaglio = new EventTarget();
    const ascolta = vi.fn();
    bersaglio.addEventListener(EVENTO_DISSINCRONIA, ascolta);

    segnalaDissincronia(new Response(null, { headers: { [HEADER_DISSINCRONIA]: '/ACPV/salvaCanale' } }), bersaglio);

    expect(ascolta).toHaveBeenCalledOnce();
    expect((ascolta.mock.calls[0][0] as CustomEvent).detail).toBe('/ACPV/salvaCanale');
  });

  it('senza header non emette niente', () => {
    const bersaglio = new EventTarget();
    const ascolta = vi.fn();
    bersaglio.addEventListener(EVENTO_DISSINCRONIA, ascolta);

    segnalaDissincronia(new Response(null), bersaglio);

    expect(ascolta).not.toHaveBeenCalled();
  });
});
