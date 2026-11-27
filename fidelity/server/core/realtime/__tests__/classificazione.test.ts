import { describe, expect, it, vi } from 'vitest';

// Servizi finti: qui conta solo quali route monta ogni controller
vi.mock('../../di', () => {
  const servizio = () => new Proxy({}, { get: () => vi.fn() });
  return {
    initializeContainer: vi.fn(async () => undefined),
    container: { get: vi.fn(() => servizio()) },
    TYPES: new Proxy({}, { get: (_target, chiave) => String(chiave) }),
  };
});
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createControllers } from '../../routes';
import { azioneDi, cambiaDati, idDi, risorsaDi } from '../classificazione';

interface Strato { route?: { path: string; methods: Record<string, boolean | undefined> } }

/** Ogni route dei controller, come "POST /api/promo". */
async function tutteLeRoute(): Promise<Array<{ metodo: string; percorso: string }>> {
  const route: Array<{ metodo: string; percorso: string }> = [];
  for (const controller of await createControllers() as unknown as Array<{ router: { stack: Strato[] }; basePath: string; initializeRoutes(): void }>) {
    if (controller.router.stack.length === 0) controller.initializeRoutes();
    for (const strato of controller.router.stack) {
      if (!strato.route) continue;
      for (const [metodo, attivo] of Object.entries(strato.route.methods)) {
        if (attivo) route.push({ metodo: metodo.toUpperCase(), percorso: `${controller.basePath}${strato.route.path}` });
      }
    }
  }
  return route;
}

describe('cambiaDati: quali richieste fanno rileggere le pagine degli altri', () => {
  it('le letture non cambiano dati', () => {
    expect(cambiaDati('GET', '/api/all_aree')).toBe(false);
    expect(cambiaDati('HEAD', '/api/promo')).toBe(false);
    expect(cambiaDati('OPTIONS', '/api/promo')).toBe(false);
  });

  it('PUT, PATCH e DELETE cambiano sempre dati', () => {
    expect(cambiaDati('PUT', '/api/ACPV/salvaArea')).toBe(true);
    expect(cambiaDati('PATCH', '/api/promo/1')).toBe(true);
    expect(cambiaDati('DELETE', '/api/ACPV/eliminaArea/3f2b4c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f')).toBe(true);
  });

  it('un POST che crea cambia dati, anche se non lo si riconosce', () => {
    expect(cambiaDati('POST', '/api/promo')).toBe(true);
    expect(cambiaDati('POST', '/api/qualcosa-di-nuovo')).toBe(true);
    expect(cambiaDati('POST', '/api/uploadTracciato/abc')).toBe(true);
  });

  it('un POST che legge, prova o apre una sessione non cambia dati', () => {
    for (const percorso of [
      '/api/scoreboard/query',
      '/api/tracciati/momenti/123/risultato',
      '/api/promo/123/export/xlsx',
      '/api/downloadKitZip',
      '/api/refs',
      '/api/files/field-values',
      '/api/get_filtered_referenze',
      '/api/login_user',
      '/api/dispositivi/heartbeat',
      '/api/recupero-password',
      '/api/auth-providers/12/verifica',
    ]) {
      expect(cambiaDati('POST', percorso), percorso).toBe(false);
    }
  });

  it('la query non conta e il metodo e\' indifferente alle maiuscole', () => {
    expect(cambiaDati('post', '/api/promo?x=1')).toBe(true);
    expect(cambiaDati('post', '/api/refs?pagina=2')).toBe(false);
  });

  it('i percorsi di sessione e di controllo non cambiano mai dati', () => {
    expect(cambiaDati('DELETE', '/api/logout')).toBe(false);
    expect(cambiaDati('POST', '/api/csrf-token')).toBe(false);
  });
});

describe('azione, tipo di dato e identificativo', () => {
  it('l\'azione segue il metodo', () => {
    expect(azioneDi('POST')).toBe('creato');
    expect(azioneDi('put')).toBe('modificato');
    expect(azioneDi('PATCH')).toBe('modificato');
    expect(azioneDi('DELETE')).toBe('eliminato');
  });

  it('il tipo di dato e\' il primo segmento dopo /api, in minuscolo, senza gli identificativi', () => {
    expect(risorsaDi('/api/ACPV/salvaArea')).toBe('acpv');
    expect(risorsaDi('/api/promo/3f2b4c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/export')).toBe('promo');
    expect(risorsaDi('/api/promo?x=1')).toBe('promo');
    expect(risorsaDi('/api')).toBe('dati');
    expect(risorsaDi('/')).toBe('dati');
  });

  it('l\'identificativo e\' l\'ultimo segmento che e\' un UUID o un numero', () => {
    expect(idDi('/api/ACPV/eliminaArea/3f2b4c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f')).toBe('3f2b4c9e-1a2b-4c3d-8e9f-0a1b2c3d4e5f');
    expect(idDi('/api/promo/123/kit')).toBe('123');
    expect(idDi('/api/promo')).toBeNull();
    expect(idDi('/api/files/abc')).toBeNull();
  });
});

describe('censimento delle route dei controller', () => {
  it('ogni route di scrittura ha una classificazione e le uniche scritture che non avvisano sono quelle elencate', async () => {
    const scritture = (await tutteLeRoute()).filter(({ metodo }) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(metodo));
    expect(scritture.length).toBeGreaterThan(200);

    const senzaAvviso = scritture
      .filter(({ metodo, percorso }) => !cambiaDati(metodo, percorso))
      .map(({ metodo, percorso }) => `${metodo} ${percorso}`)
      .sort();

    // Se aggiungi una route di scrittura che legge soltanto, o che non deve avvisare, comparira' qui:
    // aggiungila a POST_CHE_NON_CAMBIANO_DATI in classificazione.ts e a questo elenco. Una scrittura
    // nuova che cambia dati avvisa da sola.
    expect(senzaAvviso).toMatchInlineSnapshot(`
      [
        "POST /api/auth-providers/:id/verifica",
        "POST /api/auth/saml/acs/:codice",
        "POST /api/check_login_for_multiple_users",
        "POST /api/consultazione/pop/promozioni/:idPromo/zip",
        "POST /api/consultazione/pop/promozioni/:idPromo/zip/verifica",
        "POST /api/dev/hash-password",
        "POST /api/dispositivi/heartbeat",
        "POST /api/downloadKitZip",
        "POST /api/downloadKitsByTipoDiExport",
        "POST /api/downloadPromoZip",
        "POST /api/email/recupero-password",
        "POST /api/email/reset-password",
        "POST /api/export_users",
        "POST /api/external/files",
        "POST /api/external/files/field-values",
        "POST /api/external/filter-templates/validate-slug",
        "POST /api/external/refs",
        "POST /api/external/refs-html",
        "POST /api/external/refs/field-values",
        "POST /api/external/test/files",
        "POST /api/external/test/refs",
        "POST /api/get_filtered_referenze",
        "POST /api/impostazioni-gdo/insight-volantino/verifica",
        "POST /api/login_user",
        "POST /api/materiali/pop/promozioni/:idPromo/zip",
        "POST /api/materiali/pop/promozioni/:idPromo/zip/verifica",
        "POST /api/mergeFiles",
        "POST /api/ordini-stampa/group-files-by-equality",
        "POST /api/promo/:idPromo/export/indesign-json",
        "POST /api/promo/:idPromo/export/xlsx",
        "POST /api/ricercaReferenzePromo",
        "POST /api/scoreboard/multi-promo",
        "POST /api/scoreboard/promo/:idPromo",
        "POST /api/scoreboard/query",
        "POST /api/tracciati/momenti/:idMomento/risultato",
        "POST /api/tracciati/momenti/confronti/:idConfronto/risultato",
        "POST /api/webhooks/:webhookId/test",
        "POST /api/whatsapp/get_all_utenti_guest_whatsapp_count",
        "POST /api/whatsapp/invio_di_test_ad_utente",
      ]
    `);
  });

  it('PUT, PATCH e DELETE avvisano sempre, tranne i percorsi di sessione', async () => {
    const scritture = (await tutteLeRoute()).filter(({ metodo }) => ['PUT', 'PATCH', 'DELETE'].includes(metodo));
    const senzaAvviso = scritture.filter(({ metodo, percorso }) => !cambiaDati(metodo, percorso));

    expect(senzaAvviso).toEqual([]);
  });
});
